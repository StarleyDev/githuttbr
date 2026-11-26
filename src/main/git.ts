import { ipcMain, shell } from 'electron'
import { simpleGit, SimpleGit, type StatusResult } from 'simple-git'
import { isGuardedEnvKey } from '@simple-git/argv-parser'
import { basename, dirname, isAbsolute, join, relative, resolve as resolvePath, sep } from 'path'
import { pathToFileURL } from 'url'
import { readFile, writeFile, unlink, stat, chmod, mkdir, readdir, rename, cp, open, mkdtemp, rm, realpath, lstat } from 'fs/promises'
import { tmpdir, homedir } from 'os'
import { existsSync, accessSync, constants as fsConstants } from 'fs'
import { spawn, spawnSync, execFile } from 'child_process'
import { promisify } from 'util'
import { shellPathReady } from './fix-path'
import { createHash } from 'crypto'

const pexecFile = promisify(execFile)

import {
  applyDoctorFix as applyDoctorFixOnDisk,
  readRepoConfig,
  runRepoDoctor,
  suggestRepoConfig as suggestRepoConfigFromRepo,
  writeRepoConfig
} from './repoConfig'
import type {
  BlameLine,
  PrFile,
  DoctorCheck,
  DoctorFix,
  RepoConfig,
  RepoConfigResult,
  BranchCompareResult,
  PrComparison,
  CheckoutRemoteResult,
  ConflictSide,
  DivergedStrategy,
  BranchesPayload,
  BranchInfo,
  CommitBranchInfo,
  ConflictContext,
  ConflictOpKind,
  ConflictRefInfo,
  ConflictVersions,
  FileChangeKind,
  FileEntry,
  FileHistoryEntry,
  FsDropMode,
  GraphCommit,
  RemoteBranchInfo,
  RemoteInfo,
  RemoteAuthCheck,
  RepoStatus,
  RepoSummary,
  RebaseStep,
  RepoStats,
  ReflogEntry,
  BisectStatus,
  CommitSignature,
  SigningConfig,
  HooksInfo,
  HookInfo,
  LfsInfo,
  LfsFile,
  SparseCheckoutInfo,
  StashInfo,
  TagInfo,
  WorktreeInfo,
  WorktreeStatus,
  SubmoduleInfo,
  SubmoduleStatus,
  TreeEntry,
  TreeStatusKind,
  ActivityEvent,
  CodeSearchHit,
  HistorySearchHit,
  StackInfo,
  StackBranch,
  RepoInsights,
  AuthorStat,
  FileHotspot,
  ChurnPoint,
  CosmosCommit,
  ChangelogResult,
  SavedWork,
  SnapshotInfo,
  SnapshotKind,
  TeammateRadarEntry,
  TeammateRadarResult,
  CommitEditInfo,
  CommitEditStep,
  CommitEditPreview,
  CommitEditResult,
  CommitMenuProbe,
  UndoCommitResult,
  BlobAtCommit,
  CloneProgress,
  CloneOptions,
  GitflowConfig,
  GitflowKind,
  GitflowStatus,
  GitflowSnapshot,
  PushRemoteResult,
  BranchPushState,
  BranchPushResult,
  PushBranchesResult,
  UpstreamPushTarget,
  BranchCleanupCandidate,
  BranchCleanupExclusion,
  BranchCleanupScan,
  BranchDeleteRequest,
  BranchDeleteResult,
  BranchRestoreRequest,
  BranchRestoreResult,
  BranchSquashCheck,
  RerereStatus,
  SubtreeInfo,
  CleanEntry,
  CleanPreview,
  CleanResult,
  ArchiveFormat,
  ArchiveResult,
  AttributeCheck,
  CredentialCandidate,
  CredentialStatus,
  ReplaceRef,
  ReplaceStatus,
  CredentialHelperInfo,
  CredentialUrlRule,
  AttributeFile,
  DiffDriverInfo,
  DiffDriverRepoint,
  DiffDriverSuggestion,
  FilterDriverInfo,
  FilterDryRunFile,
  FilterDryRunResult,
  FilterDriverPrevious,
  ConflictCommit,
  GitObject,
  GitObjectKind,
  RefObject,
  MergeOptions,
  FsckReport,
  MaintenanceResult,
  MaintenanceStats,
  MaintenanceTask,
  BundleInfo,
  BundleRef,
  BundleResult,
  BundleScope,
  HistoryPathEntry,
  HistoryPurgePreview,
  HistoryPurgeBackup,
  HistoryPurgeResult,
  RepoHost,
  MergePreviewEntry,
  MergePreviewResult,
  MergeRiskKind,
  BlobSpec,
  SemanticDiff,
  RangeDiffEntry,
  RefTip,
  ForcedRefUpdate,
  UpstreamSuggestion,
  GitLockFile,
  AbsorbPlan,
  AbsorbTarget,
  AbsorbHunk,
  TimelapseCommit,
  RepoPulse,
  RepoDetail,
  PrPreviewMode,
  PrPreviewResult,
  PrRefCandidate,
  PrRefProbe,
  PreparedRepoChatFileAction,
  RepoFileBatchResult,
  BitbucketServerTokenKind,
  RemoteUrlCredentials
} from '../shared/types'
import { FILE_TOO_LARGE_PREFIX } from '../shared/types'
import { prRefCandidates } from '../shared/prRefs'
import { splitUnifiedDiff } from './forgejo'
import { decodeFileBytes } from '../shared/prFileText'
import { diffFileVersions } from '../shared/prFileDiff'
import { parseMergeTreeSingle, parseMergeTreeStdin, type MergeTreeRecord } from '../shared/mergeTree'
import { parseRangeDiff } from '../shared/rangeDiff'
import { countUniqueCommits, parseBranchTrackingConfig, parseRevListParents } from '../shared/branchCleanup'
import { branchMatches } from '../shared/repoConfig'
import { parseForcedUpdates } from '../shared/fetchPorcelain'
import {
  parseRemoteUrlConfig,
  remoteUrlCredentialsFrom,
  hasAmbiguousPassword,
  passwordRewrites,
  readUrlUserinfo,
  urlWithoutPassword,
  type ConfiguredRemoteUrls
} from '../shared/remoteUrlCredentials'
import {
  classifyPushState,
  duplicateDestinations,
  parsePushPorcelain,
  parseUpstreamTrack,
  pushRefspecs,
  pushResultsFrom,
  remoteMessages,
  type PushTarget
} from '../shared/pushPorcelain'
import { buildPatch, parsePatch, touchedOldLines } from '../shared/patchHunks'
import { semanticCompare } from './semantic'
import { recordEvent } from './analytics'
import { searchFileMatches, supersedeSearch, type FileSearchOptions } from './fileSearch'
import { recordLog } from './log'
import { activeProfileAuth, asProfileIdArg, boundProfileName, isProfileId, namedProfileAuth, readSettings } from './settings'
import { boundNoCredentialMessage } from './hosting'
import { apiToken, credentialFor, knownServers, providerOfRemote, resolveRemote } from './credentials'
import { isGithubComHost } from '../shared/githubEnterprise'
import { bitbucketServerGitUsername, isBitbucketCloudHost } from '../shared/bitbucketServer'
import { checkRemoteAuth, profileCredentialForUrl } from './remoteAuthCheck'
import {
  anonymousGitEnv,
  canonicalUrlHost,
  credentialContexts,
  credentialUsable,
  gitCredentialEnv,
  gitMatchesCredentialUrlPrefix,
  gitSupportsCredentialEnv,
  MIN_GIT_FOR_CREDENTIAL_ENV,
  needsConfigEnv,
  nonCanonicalHostMessage,
  releaseCredentialEnv,
  type BasicCredential,
  type CredentialScope
} from './gitCredentialEnv'
import { AsyncLocalStorage } from 'node:async_hooks'
import { indexCodegraphAsync } from './codegraph'
import { applyPreparedRepoFileActions, RepoFileActionError } from './repoFileActions'
import { PRODUCT_NAME } from '../shared/brand'
import { APP_ID, APP_IDS, LEGACY_APP_ID, isPrePurgePrefix, prePurgeRefRoot, snapshotRefRoot } from '../shared/identifiers'
import { redactSecrets } from '../shared/redact'
import { cloneFolderProblem } from '../shared/cloneFolder'
import { isEphemeralTextconv, persistBlocker } from './appImagePaths'
import { isStaleTextconv, planTextconvRepoints } from './legacyShims'

const SEP = '\x1f'

/**
 * How eagerly `git range-diff` pairs a commit with its rewritten self. git's
 * default (60) leaves small commits unpaired — they show up as a delete plus an
 * add, which is exactly the "everything changed" noise this feature exists to
 * remove. Pairing slightly too eagerly is the better failure: the interdiff is
 * right there to judge it by.
 *
 * 75 was not eager enough. A one-line change to a four-line file — the
 * `force-push` playground's "validate password", and the shape of most review
 * fixes — still scored as two unrelated commits; the pairing only holds from
 * 80 up. 85 sits clear of that edge without pairing commits that merely touch
 * the same file.
 */
const CREATION_FACTOR = '--creation-factor=85'

/** Days of commit activity summarised in a Mission Control sparkline. */
const ACTIVITY_DAYS = 14
const REC = '\x1e'

/**
 * Maps a git IPC method to the activity event it should record on success.
 * `commit` is special-cased in the dispatcher (amend flag → 'amend').
 */
const EVENT_FOR_METHOD: Record<string, ActivityEvent> = {
  push: 'push',
  pushToRemotes: 'push',
  pushBranches: 'push',
  pushAllTags: 'push',
  pull: 'pull',
  fetchAll: 'fetch',
  fetchRemote: 'fetch',
  fetchRemoteBranch: 'fetch',
  fetchPrHead: 'fetch',
  fetchCommitsById: 'fetch',
  amendCommitMessage: 'amend',
  createBranch: 'branchCreate',
  gitflowStart: 'branchCreate',
  gitflowFinish: 'merge',
  deleteBranch: 'branchDelete',
  deleteRemoteBranch: 'branchDelete',
  deleteLocalBranches: 'branchDelete',
  merge: 'merge',
  mergeInto: 'merge',
  rebase: 'rebase',
  runInteractiveRebase: 'rebase',
  stash: 'stash',
  stashPop: 'stashPop',
  resolveConflict: 'conflictResolved',
  conflictTakeSide: 'conflictResolved',
  createTag: 'tagCreate',
  cherryPick: 'cherryPick',
  revertCommit: 'revert',
  open: 'repoOpen',
  clone: 'clone',
  init: 'init',
  initHere: 'init'
}

function eventForCall(method: string, args: unknown[]): ActivityEvent | null {
  if (method === 'commit') return args[2] === true ? 'amend' : 'commit'
  // A preview either merges into HEAD or just parks a fetched ref on a branch.
  if (method === 'previewRef') return args[3] === 'merge' ? 'merge' : 'fetch'
  return EVENT_FOR_METHOD[method] ?? null
}

/** Parse `Co-authored-by` trailer values ("Name <email>") into authors. */
function parseCoAuthors(raw: string | undefined): import('../shared/types').CommitAuthor[] {
  if (!raw) return []
  return raw
    .split('\x1d')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s*<([^>]*)>\s*$/)
      return m ? { name: m[1].trim(), email: m[2].trim() } : { name: line, email: '' }
    })
}

/** Normalise git's `%G?` signature char into a {@link CommitSignature}. */
function mapSignature(char: string | undefined): CommitSignature {
  switch ((char ?? '').trim()) {
    case 'G':
      return 'good'
    case 'U': // good signature, unknown validity
    case 'E': // signature present but cannot be checked (e.g. missing public key)
      return 'unverified'
    case 'X': // expired signature
    case 'Y': // signature made by an expired key
      return 'expired'
    case 'B': // bad signature
    case 'R': // good signature made by a revoked key
      return 'bad'
    default: // 'N' or empty — no signature
      return 'none'
  }
}

/** Common client-side git hooks, in the order git documents them. */
const KNOWN_HOOKS = [
  'applypatch-msg',
  'pre-applypatch',
  'post-applypatch',
  'pre-commit',
  'pre-merge-commit',
  'prepare-commit-msg',
  'commit-msg',
  'post-commit',
  'pre-rebase',
  'post-checkout',
  'post-merge',
  'pre-push',
  'post-rewrite',
  'pre-auto-gc'
]

/** Resolve a repo's hooks directory, honouring a custom `core.hooksPath`. */
async function resolveHooksDir(git: SimpleGit, repoPath: string): Promise<{ dir: string; custom: boolean }> {
  const custom = (await git.raw(['config', '--get', 'core.hooksPath']).catch(() => '')).trim()
  if (custom) {
    let p = custom
    if (p === '~' || p.startsWith('~/')) p = join(homedir(), p.slice(1))
    else if (!p.startsWith('/')) p = join(repoPath, p)
    return { dir: p, custom: true }
  }
  const gitDir = (await git.raw(['rev-parse', '--git-path', 'hooks']).catch(() => '')).trim()
  const dir = gitDir ? (gitDir.startsWith('/') ? gitDir : join(repoPath, gitDir)) : join(repoPath, '.git', 'hooks')
  return { dir, custom: false }
}

// Cache one SimpleGit instance per repo. simple-git serializes tasks within a
// single instance, so reusing the instance makes every op on a repo run
// sequentially — preventing concurrent ops (e.g. a user checkout racing a
// watcher-triggered status refresh) from colliding on `.git/index.lock`.
const gitInstances = new Map<string, SimpleGit>()

/**
 * Config keys the app writes through simple-git that are not on its built-in safe list.
 * simple-git 4 only warns about an unlisted key; its next major refuses the write, which
 * would silently break stacks, protected branches, git-flow, rerere, subtrees and signing.
 * `*` matches any characters, dots included, so every pattern is pinned to a leaf the app
 * owns — a key named here also skips simple-git's vulnerability check, which is why this
 * is `submodule.*.url` and never `submodule.*` (that would let `submodule.x.update=!cmd`).
 */
export const APP_CONFIG_KEYS: readonly string[] = [
  // Both namespaces: new values are written under githuttbr, but clearing a
  // stack level or forgetting a subtree also unsets what upstream Gitcito left.
  ...APP_IDS.flatMap((ns) => [
    `branch.*.${ns}parent`,
    `branch.*.${ns}base`,
    `${ns}.protectedbranches`,
    `${ns}.subtree.*.url`,
    `${ns}.subtree.*.ref`,
    `${ns}.prepurge.*`
  ]),
  // git-flow's own keys, but only the layout: `gitflow.path.hooks` locates scripts.
  'gitflow.branch.*',
  'gitflow.prefix.*',
  'rerere.autoupdate',
  'commit.gpgsign',
  'gpg.format',
  'user.signingkey',
  'submodule.*.url'
]

const gitFor = (repoPath: string): SimpleGit => {
  let git = gitInstances.get(repoPath)
  if (!git) {
    git = simpleGit(repoPath, { allowConfig: APP_CONFIG_KEYS })
    gitInstances.set(repoPath, git)
  }
  return git
}

// The per-worktree git-dir (where MERGE_HEAD, rebase-merge, etc. live) never
// moves for the lifetime of a repo tab, so resolve it with `rev-parse` once
// and reuse it — `mergeState()` is polled on every refresh (watcher, 20s
// idle tick, focus), and spawning a subprocess per candidate path there adds
// up on a repo a user keeps open all day.
// `for-each-ref --merged=HEAD` has to prove ancestry for every ref it is given,
// so on a repo carrying thousands of never-deleted remote branches it costs more
// than the rest of branches() put together. Its answer depends on exactly two
// things: where HEAD is, and what every ref points at — both of which we already
// read, so the ref listing itself is the cache key. Staging a file, stashing,
// writing a note: none of them move a ref, and all of them now skip the walk.
const mergedCache = new Map<string, { key: string; refs: Set<string> }>()

async function mergedIntoHead(repoPath: string, headSha: string, refListing: string): Promise<Set<string>> {
  // No HEAD (unborn branch) means nothing can be merged into it.
  if (!headSha) return new Set()
  const key = `${headSha}\n${createHash('sha1').update(refListing).digest('hex')}`
  const hit = mergedCache.get(repoPath)
  if (hit && hit.key === key) return hit.refs

  const refs = new Set<string>()
  try {
    const out = await runGit(
      repoPath,
      ['for-each-ref', '--merged=HEAD', '--format=%(refname)', 'refs/heads', 'refs/remotes'],
      undefined,
      16 * 1024 * 1024
    )
    for (const ref of out.split('\n').filter(Boolean)) refs.add(ref)
  } catch {
    // An empty repo, or a HEAD git cannot resolve. Cache nothing rather than
    // caching an empty answer that a later valid read would have to undo.
    return refs
  }
  mergedCache.set(repoPath, { key, refs })
  return refs
}

/**
 * The one walk of the working tree a refresh needs.
 *
 * `status()` (the commit panel's file list) and `treeStatus()` (the file tree's
 * per-path badges) used to spawn a `git status` each, and on a large working
 * tree that walk is the most expensive thing a refresh does — paying for it
 * twice was the single biggest waste left. The two commands differed only by
 * `--ignored=matching`, which adds the `!!` lines and leaves everything else
 * byte-identical, so one call now serves both.
 *
 * The map is in-flight coalescing, not a cache: `doRefresh` issues both reads
 * in the same tick, so they share one process, and the entry is dropped the
 * moment it settles. Nothing is ever served from a previous refresh — and as a
 * side effect the two halves can no longer disagree, which two independent
 * snapshots could.
 */
const statusInFlight = new Map<string, Promise<StatusResult>>()

async function statusScan(repoPath: string): Promise<StatusResult> {
  const running = statusInFlight.get(repoPath)
  if (running) return running
  const p = gitFor(repoPath).status(['--ignored=matching'])
  statusInFlight.set(repoPath, p)
  try {
    return await p
  } finally {
    statusInFlight.delete(repoPath)
  }
}

const gitDirCache = new Map<string, string>()
async function absoluteGitDir(repoPath: string): Promise<string> {
  const cached = gitDirCache.get(repoPath)
  if (cached) return cached
  const dir = (await gitFor(repoPath).raw(['rev-parse', '--absolute-git-dir'])).trim()
  gitDirCache.set(repoPath, dir)
  return dir
}

// Bounded LRU for immutable, content-addressed reads. A commit's file list and
// diff never change for a given sha, so re-opening the same commit (or paging
// its files) can be served from memory instead of re-shelling git. Rewritten
// shas (amend/rebase) simply orphan their old entries, which age out.
class LruCache<V> {
  private map = new Map<string, V>()
  private bytes = 0
  constructor(
    private readonly max: number,
    // Byte-bound the cache too: 500 entries of multi-MB lockfile diffs is
    // gigabytes while the entry count reads as "within limits".
    private readonly maxBytes: number,
    private readonly sizeOf: (v: V) => number
  ) {}
  get(key: string): V | undefined {
    const v = this.map.get(key)
    if (v !== undefined) {
      this.map.delete(key)
      this.map.set(key, v) // mark most-recently-used
    }
    return v
  }
  set(key: string, value: V): void {
    const size = this.sizeOf(value)
    // An entry bigger than half the byte budget would evict everything else
    // for one hit — cheaper to just recompute it on demand.
    if (size > this.maxBytes / 2) return
    const prev = this.map.get(key)
    if (prev !== undefined) {
      this.map.delete(key)
      this.bytes -= this.sizeOf(prev)
    }
    this.map.set(key, value)
    this.bytes += size
    while (this.map.size > this.max || this.bytes > this.maxBytes) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      const evicted = this.map.get(oldest)
      this.map.delete(oldest)
      if (evicted !== undefined) this.bytes -= this.sizeOf(evicted)
    }
  }
}
// JS strings are UTF-16 → ~2 bytes per code unit.
const strBytes = (s: string): number => s.length * 2
const commitDiffCache = new LruCache<string>(500, 48 * 1024 * 1024, strBytes)
const commitFilesCache = new LruCache<FileEntry[]>(
  500,
  16 * 1024 * 1024,
  (files) => files.reduce((n, f) => n + strBytes(f.path) + 64, 0)
)
async function memo<V>(cache: LruCache<V>, key: string, fetch: () => Promise<V>): Promise<V> {
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const val = await fetch()
  cache.set(key, val)
  return val
}

/**
 * Auto-stash. If the working tree is dirty, shelve it under a
 * NAMED stash (visible in the stash list), run the operation, then restore it.
 *
 *  - Clean tree → runs the op directly, no stash.
 *  - Op fails    → the named stash is left untouched so the user's changes stay
 *                  recoverable; the original error is surfaced.
 *  - Pop conflicts on restore → git keeps the named stash and the conflict
 *                  surfaces to the user to resolve (their changes aren't lost).
 */
async function withAutoStash<T>(
  repoPath: string,
  label: string,
  op: () => Promise<T>
): Promise<T> {
  const git = gitFor(repoPath)
  const st = await git.status()
  if (st.files.length === 0) return op()
  await git.stash(['push', '--include-untracked', '-m', `Auto-stash before ${label}`])
  const result = await op() // if this throws, the named stash is left for recovery
  await git.stash(['pop']) // a pop conflict throws; git keeps the stash regardless
  return result
}

/**
 * A git config key cannot hold a slash in its subsection when written this way,
 * and a prefix is a path — so it is encoded, and decoded on the way back.
 */
function encodeSubtreeKey(prefix: string): string {
  return prefix.replace(/\//g, '%2F')
}

function decodeSubtreeKey(key: string): string {
  return key.replace(/%2F/g, '/')
}

/**
 * The remembered URL of `prefix` when `shown` is that URL as the renderer got
 * it (without its password, `subtrees`), else `shown` itself — so pulling or
 * pushing a subtree from the list keeps working with the credential it had,
 * without the password ever crossing to the renderer.
 */
async function rememberedSubtreeUrl(repoPath: string, prefix: string, shown: string): Promise<string> {
  const key = encodeSubtreeKey(prefix)
  for (const ns of [APP_ID, LEGACY_APP_ID]) {
    const saved = (await runGit(repoPath, ['config', '--get', `${ns}.subtree.${key}.url`]).catch(() => '')).trim()
    if (saved && saved !== shown && urlWithoutPassword(saved) === shown) return saved
    if (saved) return shown
  }
  return shown
}

/** Remember where a subtree came from — git itself keeps no such record. */
async function rememberSubtree(repoPath: string, prefix: string, url: string, ref: string): Promise<void> {
  const key = encodeSubtreeKey(prefix)
  const git = gitFor(repoPath)
  await git.raw(['config', `${APP_ID}.subtree.${key}.url`, url])
  await git.raw(['config', `${APP_ID}.subtree.${key}.ref`, ref])
}

// ─── Stack metadata in git config ───────────────────────────────────────────
// branch.<name>.githuttbrparent / .githuttbrbase, read with a fallback to the
// keys upstream Gitcito wrote (gitcitoparent / gitcitobase), so a stack built
// before the rename is still a stack. Writes always go to the new keys.

type StackField = 'parent' | 'base'

async function readStackMeta(git: SimpleGit, branch: string, field: StackField): Promise<string> {
  for (const ns of APP_IDS) {
    const value = (await git.raw(['config', '--get', `branch.${branch}.${ns}${field}`]).catch(() => '')).trim()
    if (value) return value
  }
  return ''
}

async function writeStackMeta(git: SimpleGit, branch: string, field: StackField, value: string): Promise<void> {
  await git.raw(['config', `branch.${branch}.${APP_ID}${field}`, value])
}

/** Unset under both names — a legacy key left behind would quietly bring the link back. */
async function clearStackMeta(git: SimpleGit, branch: string, field: StackField): Promise<void> {
  for (const ns of APP_IDS) await git.raw(['config', '--unset', `branch.${branch}.${ns}${field}`]).catch(() => {})
}

/** Every recorded stack parent, branch → parent. The new key wins over a legacy one. */
async function readStackParents(git: SimpleGit): Promise<Map<string, string>> {
  const parents = new Map<string, string>()
  // Legacy first, so the current namespace overwrites it.
  for (const ns of [...APP_IDS].reverse()) {
    const raw = await git.raw(['config', '--get-regexp', `^branch\\..*\\.${ns}parent$`]).catch(() => '')
    for (const line of raw.split('\n')) {
      const sp = line.indexOf(' ')
      if (sp < 0) continue
      const key = line.slice(0, sp) // branch.<name>.<ns>parent
      const name = key.slice('branch.'.length, key.length - `.${ns}parent`.length)
      if (name) parents.set(name, line.slice(sp + 1).trim())
    }
  }
  return parents
}

/**
 * `git subtree` is a shell script shipped alongside git, not a builtin, so a
 * stripped-down install can be missing it. Say that plainly instead of letting
 * "'subtree' is not a git command" reach a toast.
 */
async function runSubtree(repoPath: string, args: string[]): Promise<string> {
  // The script hands the repository and ref straight to `git fetch`/`git push`
  // without a `--`, so an option-shaped one must never reach it.
  for (const a of args.slice(1)) {
    if (!a.startsWith('--prefix=') && a !== '--squash' && a !== '-b') assertNotOption(a, 'a subtree argument')
  }
  // `git subtree` checks for local modifications with a plumbing command that
  // trusts the index's stat cache. A repository whose files were touched without
  // being changed — a checkout, a copy, a restored backup — then looks dirty and
  // the command refuses. Porcelain refreshes first; so do we.
  await runGit(repoPath, ['update-index', '-q', '--refresh']).catch(() => undefined)
  try {
    return await runGit(repoPath, ['subtree', ...args])
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/is not a git command|subtree.*not found/i.test(message)) {
      throw new Error("This git installation has no `git subtree` — it ships as a contrib script and is missing here.")
    }
    throw err
  }
}

/**
 * Files git resolved from a memorised resolution during the operation that is
 * currently conflicted, per repository.
 *
 * Git only says so once — "Resolved 'x' using previous resolution." on the
 * output of the merge/rebase that hit the conflict — and nothing in the
 * repository records it afterwards. Deriving it from `rerere status`/`remaining`
 * later does not work: after a replay the file is absent from both, and so is a
 * conflict rerere never understood. So it is captured when it is said.
 *
 * Session state on purpose: if Gitcito restarts mid-conflict the hint is simply
 * gone, which is better than showing a guess.
 */
const rerereReplayed = new Map<string, string[]>()

const RESOLVED_LINE = /Resolved '(.+?)' using previous resolution/g

/** Run an operation that may conflict, noting any rerere replays it announces. */
async function withRerereCapture<T>(repoPath: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op()
  } catch (err) {
    const output = err instanceof Error ? err.message : String(err)
    const files: string[] = []
    for (const match of output.matchAll(RESOLVED_LINE)) files.push(match[1])
    if (files.length) rerereReplayed.set(repoPath, files)
    throw err
  }
}

/** Config key holding the paths a purge removed. Git config keys must begin
 *  with a letter, so the timestamp cannot stand alone. */
function prePurgeKey(at: number, ns: string = APP_ID): string {
  return `${ns}.prepurge.at${at}`
}

/**
 * Total size of every blob ever stored at `paths`. Walks all reachable objects
 * once and keeps the ones whose recorded name matches — `rev-list --objects`
 * prints `<sha> <path>` for anything that has a name.
 */
async function blobBytesForPaths(repoPath: string, paths: string[]): Promise<number> {
  const wanted = new Set(paths)
  const listed = await runGit(repoPath, ['rev-list', '--objects', '--branches', '--tags', '--', ...paths]).catch(
    () => ''
  )
  const shas = new Set<string>()
  for (const line of listed.split('\n')) {
    const space = line.indexOf(' ')
    if (space <= 0) continue
    const name = line.slice(space + 1).trim()
    if (wanted.has(name)) shas.add(line.slice(0, space))
  }
  if (!shas.size) return 0

  // `cat-file --batch-check` would need a stdin pipe; a handful of blobs is
  // cheaper to size one at a time than to wire that up.
  let bytes = 0
  for (const sha of shas) {
    const size = await runGit(repoPath, ['cat-file', '-s', sha]).catch(() => '')
    bytes += Number(size.trim()) || 0
  }
  return bytes
}

/**
 * Turn {@link MergeOptions} into git flags.
 *
 * Accepts a bare boolean as well: every caller before merge options existed
 * passed `noFf` positionally, and a merge is not the place to break a signature.
 */
function mergeArgs(options: MergeOptions | boolean): string[] {
  const o: MergeOptions = typeof options === 'boolean' ? { noFf: options } : (options ?? {})
  const args: string[] = []
  if (o.ffOnly) args.push('--ff-only')
  else if (o.noFf) args.push('--no-ff')
  if (o.squash) args.push('--squash')
  if (o.noCommit) args.push('--no-commit')
  if (o.strategy && o.strategy !== 'ort') args.push('-s', o.strategy)
  // -X ours/theirs resolves only the hunks that actually clash. It is not
  // `-s ours`, which throws the other side away wholesale — a difference worth
  // keeping straight, since one is routine and the other loses work.
  if (o.favour) args.push('-X', o.favour)
  if (o.ignoreSpace) args.push('-X', `ignore-space-${o.ignoreSpace === 'eol' ? 'at-eol' : o.ignoreSpace}`)
  return args
}

/** In-flight `git bisect run` children, so one can be stopped by repo path. */
const bisectRuns = new Map<string, import('child_process').ChildProcess>()

/** How much of a blob the object explorer shows before saying "truncated". */
const OBJECT_BLOB_PREVIEW = 200_000

/**
 * Does a configured credential helper actually exist?
 *
 * git resolves a bare name to `git-credential-<name>`, which lives beside git
 * rather than on PATH — hence the exec-path probe. A `!`-prefixed value is a
 * shell command git runs verbatim, so only its first word can be checked.
 */
function credentialHelperExists(value: string): boolean {
  const raw = value.trim()
  if (!raw) return false
  if (raw.startsWith('!')) return hasBinary(raw.slice(1).trim().split(/\s+/)[0].replace(/^"|"$/g, ''))
  const name = raw.split(/\s+/)[0]
  // Absolute path, or a command of its own.
  if (name.includes('/') || name.includes('\\')) return existsSync(name) || hasBinary(name)
  if (name === 'cache' || name === 'store') return true // built into git itself
  if (hasBinary(`git-credential-${name}`)) return true
  const execPath = spawnSync('git', ['--exec-path'], { encoding: 'utf-8' }).stdout?.trim()
  return !!execPath && existsSync(join(execPath, `git-credential-${name}`))
}

/** The helpers worth offering on this platform, and whether they are installed. */
function credentialCandidates(): CredentialCandidate[] {
  const platform = process.platform
  const names =
    platform === 'darwin'
      ? ['osxkeychain', 'cache', 'store']
      : platform === 'win32'
        ? ['manager', 'wincred', 'cache', 'store']
        : ['libsecret', 'cache', 'store']
  const best = platform === 'darwin' ? 'osxkeychain' : platform === 'win32' ? 'manager' : 'libsecret'
  return names.map((name) => ({
    name,
    available: credentialHelperExists(name),
    recommended: name === best
  }))
}

/** Is this command on PATH? Used to say which diff converters are real here. */
function hasBinary(command: string): boolean {
  const probe = process.platform === 'win32' ? 'where' : 'which'
  try {
    return spawnSync(probe, [command], { stdio: 'ignore' }).status === 0
  } catch {
    return false
  }
}

/** Rewrite a fresh worktree's `.git` file so its `gitdir:` line is relative
 *  to the worktree root. `git worktree add` stamps the absolute drive-letter
 *  path (`gitdir: E:/repo/.git/worktrees/x`), which shells that don't speak
 *  drive letters — WSL agents in particular — cannot resolve. Git resolves a
 *  relative `gitdir:` against the `.git` file's own directory on every
 *  platform, so the tree works from Windows and WSL alike. The reverse
 *  `gitdir` file inside the metadata dir stays absolute: git resolves it
 *  against the process cwd, so relativising it would break `worktree list`. */
async function makeWorktreeGitfilePortable(worktreePath: string): Promise<void> {
  try {
    const gitFile = join(worktreePath, '.git')
    const text = await readFile(gitFile, 'utf-8')
    const m = /^gitdir:[ \t]*(.+)$/m.exec(text)
    if (!m) return
    // Git stamps the realpath, so relativise from the realpath too: through a
    // symlink (macOS /var → /private/var) the hops would otherwise miss by one.
    const root = await realpath(worktreePath)
    const gitDir = await realpath(resolvePath(root, m[1].trim()))
    const rel = relative(root, gitDir).split(sep).join('/')
    if (!rel || isAbsolute(rel)) return // cross-drive or unresolved — keep git's
    await writeFile(gitFile, `gitdir: ${rel}\n`)
  } catch {
    /* portability rewrite is best-effort */
  }
}

/** Ignored directories that are generated rather than personal config —
 *  copying them into a fresh worktree would drag megabytes for nothing. */
const WORKTREE_COPY_SKIP_DIRS = new Set([
  // '.git': ls-files never reports inside it, and a collapsed ignored dir may
  // contain a nested repo whose internals must not be copied either.
  '.git',
  'node_modules', 'bower_components', 'vendor', 'dist', 'build', 'out',
  'target', 'bin', 'obj', 'coverage', '.nyc_output',
  '.next', '.nuxt', '.svelte-kit', '.output', '.vercel',
  '.venv', 'venv', 'env', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
  '.turbo', '.cache', '.parcel-cache', '.gradle', '.idea', '.vs',
  'DerivedData', 'Pods', '.terraform', '.serverless', '.aws-sam'
])

/** Bigger than this is a build artefact or dataset, not a local config file. */
const WORKTREE_COPY_MAX_BYTES = 64 * 1024 * 1024

/** Copy one file into the worktree unless it's skippable (oversized artefact
 *  or symlink — a symlinked .env would drag the target file's contents into
 *  an unexpected location). */
async function copyIgnoredFile(from: string, to: string): Promise<void> {
  const info = await lstat(from).catch(() => null)
  if (!info?.isFile() || info.isSymbolicLink() || info.size > WORKTREE_COPY_MAX_BYTES) return
  await mkdir(dirname(to), { recursive: true })
  await cp(from, to)
}

/** Recursive copy for a collapsed ls-files entry ('name/'). Git only
 *  collapses a directory when everything inside is untracked-and-ignored —
 *  a dir holding a mix of ignored and merely-untracked files is still
 *  expanded — so the whole tree can be copied without re-asking git. */
async function copyIgnoredDir(fromDir: string, toDir: string): Promise<void> {
  const entries = await readdir(fromDir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (WORKTREE_COPY_SKIP_DIRS.has(entry.name)) continue
    const from = join(fromDir, entry.name)
    if (entry.isDirectory()) {
      await copyIgnoredDir(from, join(toDir, entry.name))
    } else {
      await copyIgnoredFile(from, join(toDir, entry.name))
    }
  }
}

/** A new worktree starts without .env and friends because git never tracks
 *  them — copy the source repo's ignored files across so it starts runnable.
 *  Enumerated through git's own ignore machinery, so nested .gitignore files,
 *  .git/info/exclude and global excludes all count. `--directory` collapses a
 *  fully-ignored dir to a single 'dir/' entry, so a huge ignored tree like
 *  node_modules costs one entry instead of git descending it file by file
 *  (measured ~1.9s → ~100ms on a node repo). */
async function copyIgnoredIntoWorktree(srcRepo: string, dest: string): Promise<void> {
  const out = await gitFor(srcRepo)
    .raw(['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'])
    .catch(() => '')
  for (const rel of out.split('\0').filter(Boolean)) {
    if (rel.split('/').some((part) => WORKTREE_COPY_SKIP_DIRS.has(part))) continue
    if (rel.endsWith('/')) {
      await copyIgnoredDir(join(srcRepo, rel), join(dest, rel))
    } else {
      await copyIgnoredFile(join(srcRepo, rel), join(dest, rel))
    }
  }
}

/** The textconv shim Gitcito ships (resources/cli/githuttbr-textconv). */
export function bundledTextconvPath(): string {
  // Packaged: extraResources puts cli/ next to app.asar. Source checkout and
  // tests: resources/ sits at the repo root, two levels up from this file.
  const packaged = process.resourcesPath ? join(process.resourcesPath, 'cli', 'githuttbr-textconv') : ''
  if (packaged && existsSync(packaged)) return packaged
  return resolvePath(__dirname, '../../resources/cli/githuttbr-textconv')
}

/**
 * Rewrite the pre-4.39 converter entries of one config scope to the converter
 * this install ships. Only entries naming `gitcito-textconv` are touched; under
 * an AppImage nothing is (the mount path must never be persisted — those
 * entries keep their stale badge), nor when the shim is not there to run.
 */
async function repointLegacyTextconvs(cwd: string, scope: 'repo' | 'global'): Promise<DiffDriverRepoint[]> {
  const flag = scope === 'global' ? '--global' : '--local'
  const listing = await runGit(cwd, ['config', flag, '--get-regexp', '^diff\\..*\\.textconv$']).catch(() => '')
  if (!listing.trim()) return []
  const shim = bundledTextconvPath()
  const resources = process.resourcesPath ?? ''
  const plan = planTextconvRepoints(listing, shim, {
    blocked: !!persistBlocker(shim, resources) || !canExecute(shim),
    ephemeral: (textconv) => isEphemeralTextconv(textconv, process.env, resources)
  })
  const done: DiffDriverRepoint[] = []
  for (const entry of plan) {
    try {
      await runGit(cwd, ['config', flag, `diff.${entry.name}.textconv`, entry.next])
      done.push({ ...entry, scope })
    } catch (err) {
      // One unwritable entry (a read-only include, a locked config) must not
      // stop the rest; it keeps its stale badge and the Remove button.
      console.warn(`[textconv] could not repoint diff.${entry.name}.textconv:`, (err as Error).message)
    }
  }
  return done
}

/** Started once per process; what it rewrote waits for the first repository to report it. */
let globalRepoint: Promise<DiffDriverRepoint[]> | null = null
let globalRepointReported = false

/**
 * Repoint the user's global config, once per run. Called at start-up so the
 * terminal's `git diff` works before any repository is opened; repository
 * opens await the same promise, so the two never write the config at once.
 */
export function repointGlobalLegacyTextconvs(): Promise<DiffDriverRepoint[]> {
  globalRepoint ??= repointLegacyTextconvs(homedir(), 'global').catch(() => [])
  return globalRepoint
}

/** Test seam: forget this run's global repoint, as a fresh start would. */
export function resetGlobalTextconvRepoint(): void {
  globalRepoint = null
  globalRepointReported = false
}

function canExecute(path: string): boolean {
  try {
    accessSync(path, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Dry-run bounds: enough to judge a filter, cheap enough to run on a click. */
const FILTER_DRY_RUN_FILES = 5
const FILTER_DRY_RUN_MAX_BYTES = 5 * 1024 * 1024
const FILTER_PREVIEW_BYTES = 400
const FILTER_TIMEOUT_MS = 10_000

/**
 * Run one clean/smudge command the way git would: content on stdin, result on
 * stdout, `%f` replaced by the repo-relative path. Used only by the dry run —
 * git itself runs the real thing after the config is written.
 */
function runFilterCommand(command: string, cwd: string, file: string, input: Buffer): Promise<Buffer> {
  const cmd = command.replaceAll('%f', `'${file.replaceAll("'", "'\\''")}'`)
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, { cwd, shell: true, stdio: ['pipe', 'pipe', 'pipe'] })
    const out: Buffer[] = []
    const errOut: Buffer[] = []
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`filter command timed out after ${FILTER_TIMEOUT_MS / 1000}s`))
    }, FILTER_TIMEOUT_MS)
    child.stdout.on('data', (c: Buffer) => out.push(c))
    child.stderr.on('data', (c: Buffer) => errOut.push(c))
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolvePromise(Buffer.concat(out))
      else reject(new Error(Buffer.concat(errOut).toString('utf-8').trim() || `filter command exited with ${code}`))
    })
    child.stdin.on('error', () => undefined) // command may exit without reading stdin
    child.stdin.end(input)
  })
}

/**
 * Whether a configured textconv command can actually run: a path (quoted or
 * not) is checked on disk, a bare command on PATH.
 */
export function converterAvailable(textconv: string): boolean {
  const m = /^"([^"]+)"|^(\S+)/.exec(textconv.trim())
  const cmd = m ? (m[1] ?? m[2]) : ''
  if (!cmd) return false
  return cmd.includes('/') || cmd.includes('\\') ? canExecute(cmd) : hasBinary(cmd)
}

/** How many removable paths a clean preview will size and show. */
const CLEAN_ENTRY_CAP = 400

/** How many files a directory walk will stat before giving up on an exact size. */
const CLEAN_WALK_CAP = 20000

/** Space a file actually occupies, not the length of its contents.
 *
 *  The difference is not academic here: a loose git object is a few hundred
 *  bytes in a 4 KB block, so a repository with a thousand of them costs 4 MB of
 *  disk and reports 250 KB of content. `git count-objects` answers in blocks,
 *  and a panel that mixes the two makes the parts add up to more than the whole.
 *  `blocks` is absent on some Windows filesystems — fall back to the length. */
function diskBytes(s: { size: number; blocks?: number }): number {
  return s.blocks && s.blocks > 0 ? s.blocks * 512 : s.size
}

/**
 * Bytes under a directory, as the disk gives them up. Capped: an untracked
 * `node_modules` holds hundreds of thousands of files, and a preview that stats
 * all of them is a preview nobody waits for. Hitting the cap under-reports
 * rather than stalls.
 */
async function dirBytes(dir: string, budget: { files: number }): Promise<number> {
  let total = 0
  const stack = [dir]
  while (stack.length && budget.files > 0) {
    const current = stack.pop() as string
    const entries = await readdir(current, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (budget.files-- <= 0) break
      const full = join(current, entry.name)
      // Symlinks are never followed: their target may sit outside the repo.
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile()) total += await stat(full).then(diskBytes).catch(() => 0)
    }
  }
  return total
}

/**
 * Everything `git clean` could remove, as git itself sees it.
 *
 * `--directory` collapses a wholly untracked folder into one entry (`dist/`)
 * instead of listing every file inside it — the same grouping `git clean -d`
 * removes by, and the only listing short enough to read.
 */
async function cleanCandidates(repoPath: string): Promise<{ untracked: string[]; ignored: string[] }> {
  const list = async (extra: string[]): Promise<string[]> => {
    const out = await runGit(repoPath, [
      'ls-files',
      '-z',
      '--others',
      '--exclude-standard',
      '--directory',
      '--no-empty-directory',
      ...extra
    ]).catch(() => '')
    return out.split('\0').filter(Boolean)
  }
  return { untracked: await list([]), ignored: await list(['--ignored']) }
}

/** The configured branch prefix for a git-flow kind. */
function prefixFor(config: GitflowConfig, kind: GitflowKind): string {
  return kind === 'feature' ? config.featurePrefix : kind === 'release' ? config.releasePrefix : config.hotfixPrefix
}

/** Local branch names, short form. */
async function localBranches(repoPath: string): Promise<string[]> {
  const raw = await gitFor(repoPath)
    .raw(['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
    .catch(() => '')
  return raw.split('\n').map((l) => l.trim()).filter(Boolean)
}

/**
 * The username/password pair a provider's HTTPS git endpoint takes for a token.
 * GitHub and GitLab accept the token with a fixed username, and a Bitbucket app
 * password is stored as `username:app_password`.
 *
 * Azure DevOps ignores the username when the password is a PAT — but it must not
 * be **empty**: given an empty username, git never sends the password at all
 * (no Authorization header goes out) and reports "Authentication failed" for a
 * valid token. So the remote URL's username is used when it has one — Azure
 * writes `https://<org>@dev.azure.com/…` into every clone URL it hands out — and
 * a fixed placeholder otherwise. test/azureBasicAuth.test.ts shows the difference.
 */
export function basicAuthFor(
  host: RepoHost | undefined,
  token: string,
  url?: string,
  gitUsername?: string,
  tokenKind?: BitbucketServerTokenKind
): { username: string; password: string } | null {
  const t = token.trim()
  if (!t) return null
  switch (host) {
    case 'github':
    case 'gitlab':
    // Forgejo/Gitea read an access token from the password field whatever the username.
    case 'forgejo':
      return { username: 'oauth2', password: t }
    case 'bitbucket': {
      // A Data Center HTTP access token: the Settings name, else the remote URL's
      // (Bitbucket's clone URLs are `https://<user>@host/scm/…`), else
      // `x-token-auth` — unless Settings says whose token it is
      // (`bitbucketServerGitUsername`). A personal token with no name anywhere
      // gets no credential rather than one Bitbucket is sure to refuse.
      if (url && !isBitbucketCloudHostOf(url)) {
        const username = bitbucketServerGitUsername(gitUsername, urlUsername(url), tokenKind)
        return username ? { username, password: t } : null
      }
      if (!t.includes(':')) return { username: 'x-token-auth', password: t }
      const [user, ...rest] = t.split(':')
      return { username: user, password: rest.join(':') }
    }
    case 'azure':
      return { username: urlUsername(url) || AZURE_PAT_USERNAME, password: t }
    default:
      return null
  }
}

/** Whether an https URL is on bitbucket.org — anything else a `bitbucket` host maps to is a Data Center. */
function isBitbucketCloudHostOf(url: string): boolean {
  try {
    return isBitbucketCloudHost(new URL(url).hostname)
  } catch {
    return true
  }
}

/** Any non-empty name works with an Azure DevOps PAT; this one says what it is. */
const AZURE_PAT_USERNAME = 'pat'

/** The username written in an https URL (`https://user@host/…`), or ''. */
function urlUsername(url: string | undefined): string {
  if (!url) return ''
  try {
    return decodeURIComponent(new URL(url).username)
  } catch {
    return ''
  }
}

/**
 * The environment that lets a clone or a clone-dialog `ls-remote` authenticate
 * with the integration's PAT, or null when it does not apply. Same mechanism as
 * `withRemoteAuth`: the token never enters the URL, so it is in neither the
 * process list nor the new repository's `.git/config` — not even for the
 * duration of the clone, which a crash or a kill would otherwise leave behind.
 *
 * `profileId` is the profile picked in the clone dialog — the one its provider
 * tab listed repositories with and the new repository is then bound to — so a
 * repository is listed, cloned and later fetched as one account. An empty or
 * unknown id gets nothing (an anonymous clone), never the active profile's or
 * the first one's — and git's own credential helpers are switched off for the
 * host, so no login the machine holds answers either. Absent — or not a string,
 * which names nobody — means a clone nobody picked a profile for: the active
 * one, and when it has nothing, git's helpers as usual.
 */
export async function cloneCredentialEnv(
  url: string,
  host?: string,
  token?: string,
  profileIdArg?: unknown
): Promise<NodeJS.ProcessEnv | null> {
  const profileId = asProfileIdArg(profileIdArg)
  // A picked profile, or a token sent for one: never left to the machine's helper.
  if (profileId !== undefined || (host && token?.trim())) assertCanonicalHost(url)
  const env = await profileCredentialEnv(url, host, token, profileId)
  if (env) return env
  // A picked profile with no usable credential clones as nobody. Left to git,
  // its own credential helper would answer — a system credential manager
  // holding another account's login for this host — and the repository would
  // then be bound to the picked profile while cloned as someone else. A clone
  // nobody picked a profile for keeps git's own behaviour, as in a terminal —
  // and so does Clone → URL (no host) for an address no profile can serve: the
  // user pasted it, and the helper may be the only way in to that server.
  if (profileId === undefined) return null
  if (!host && !(await servedProviderOf(url))) return null
  return anonymousServerEnv(url)
}

/**
 * The provider a pasted clone address is on when a profile could hold its
 * credential: a cloud host, or under a server some profile configures (by its
 * base — a hostname match alone names no server whose token belongs there).
 * Undefined for anything else, which Clone → URL leaves to git.
 */
async function servedProviderOf(url: string): Promise<RepoHost | undefined> {
  await readSettings() // populates the server registries resolveRemote reads
  const r = resolveRemote(url)
  return r && (r.base || r.provider === 'azure') ? r.provider : undefined
}

/**
 * Where a remote's credential — or its absence — is registered (see
 * `CredentialScope`): its server, never its one repository. The env reaches
 * every git the operation runs, submodules included, so it must not cover
 * another server; and it must cover the whole server, because git-lfs asks
 * about `<repo>.git/info/lfs` and a server may redirect `/g/p` to `/g/p.git`,
 * neither of which an exact-path entry matches.
 *
 * - One server alone on its origin, at the root: the origin.
 * - Under a context path: that base — a GitLab at the root beside it is not
 *   covered.
 * - Bases on one origin are disjoint unless one nests under another (a GitLab
 *   at the root, a Data Center at `/bitbucket`). The outer one then takes its
 *   base with every nested server carved out: an empty helper entry there, so
 *   neither this token nor the machine's helper answers for it during this
 *   command. The nested one's base is the longer path, outside the outer's
 *   entries already.
 * - A remote on no configured base (only the hostname is known): the origin,
 *   with every configured server there carved out the same way.
 */
function credentialScopeFor(url: string): CredentialScope {
  const r = resolveRemote(url)
  // Azure has no configurable server: dev.azure.com is the only one.
  if (r?.provider === 'azure') return 'host'
  let origin: string
  try {
    origin = new URL(url).origin
  } catch {
    return 'host'
  }
  const norm = (b: string): string => b.replace(/\/+$/, '')
  const sameOrigin = (b: string): boolean => {
    try {
      return new URL(b).origin === origin
    } catch {
      return false
    }
  }
  // A cloud's fixed base names its apex; a subdomain it also serves
  // (`gist.github.com`) is that server on an origin of its own.
  const own = r?.base && sameOrigin(r.base) ? norm(r.base) : origin
  const { gitlab, forgejo, githubEnterprise, bitbucketServer } = knownServers()
  const exclude = [...gitlab, ...forgejo, ...githubEnterprise, ...bitbucketServer]
    .map(norm)
    .filter((b) => b !== own && sameOrigin(b))
  return { prefix: own, exclude }
}

let anonymousFormProbe: Promise<{ configCount: boolean; exactUrlMatch: boolean }> | null = null
/**
 * How the installed git reads the entries that make it ask as nobody: whether
 * it reads `GIT_CONFIG_COUNT` (2.31) — `GIT_CONFIG_PARAMETERS` otherwise — and
 * whether it matches `credential.<url>` only exactly (before 2.26; see
 * `anonymousGitEnv`). An output that cannot be read counts as old here, since
 * the older form works everywhere.
 */
function anonymousConfigForm(): Promise<{ configCount: boolean; exactUrlMatch: boolean }> {
  anonymousFormProbe ??= pexecFile('git', ['--version']).then(
    ({ stdout }) => {
      const v = gitSupportsCredentialEnv(String(stdout))
      return { configCount: v.ok && v.found !== undefined, exactUrlMatch: !gitMatchesCredentialUrlPrefix(String(stdout)) }
    },
    () => ({ configCount: false, exactUrlMatch: true })
  )
  return anonymousFormProbe
}

/** `anonymousGitEnv` for `url`'s server, in the config form the installed git reads best. */
async function anonymousServerEnv(
  url: string,
  base: NodeJS.ProcessEnv = process.env
): Promise<NodeJS.ProcessEnv | null> {
  return anonymousGitEnv(url, base, credentialScopeFor(url), await anonymousConfigForm())
}

/**
 * Refuse, for an operation acting for a profile, a remote whose host git reads
 * differently from the app (`canonicalUrlHost`): no credential entry would
 * apply to it, so the machine's helper would answer — another account, for a
 * profile that names one. Only http(s) has a credential step to protect.
 */
function assertCanonicalHost(url: string): void {
  if (/^https?:\/\//i.test(url) && !canonicalUrlHost(url)) throw new Error(nonCanonicalHostMessage(url))
}

async function profileCredentialEnv(
  url: string,
  host: string | undefined,
  token: string | undefined,
  profileId: string | undefined
): Promise<NodeJS.ProcessEnv | null> {
  if (!/^https:\/\//i.test(url)) return null
  if (profileId !== undefined && !(await isProfileId(profileId))) return null
  // Clone → URL names no provider, so it is told from the URL itself by the
  // rule every remote follows (host, port and context path): a cloud host, or a
  // server a profile configures — whose token is filed under that base, so no
  // other server can be offered it. Anything else is left to git.
  // A token sent with no provider named says nothing about whose it is, so it
  // is never used: the picked (or active) profile's own credential is.
  if (!host) {
    host = await servedProviderOf(url)
    if (!host) return null
    token = undefined
  }
  // The caller names the provider; the URL must really be on it.
  if (hostFromUrl(url) !== host) return null
  // A GitLab or Forgejo token only goes to the instance that issued it — never
  // to another profile's server. GitHub likewise: the renderer's token is
  // github.com's, so a clone from an Enterprise Server uses the token the
  // profile filed for that server. Resolved here even when the renderer sent
  // none: its copy of the settings carries no tokens until Settings has been
  // opened, and a self-managed server's token is never the one it would send.
  const ghes = host === 'github' && !isGithubComHost(new URL(url).hostname)
  // Bitbucket the same: the renderer's token is bitbucket.org's; a Data Center
  // clone uses the token (and user name) the profile filed for that server.
  const dc = host === 'bitbucket' && !isBitbucketCloudHost(new URL(url).hostname)
  const selfHosted = host === 'gitlab' || host === 'forgejo' || ghes || dc
  // github.com, bitbucket.org and Azure clone with the renderer's token — the
  // picked profile's.
  const sent = selfHosted ? undefined : token?.trim()
  if (sent) {
    const auth = basicAuthFor(host as RepoHost, sent, url)
    return auth ? gitCredentialEnv(url, auth, process.env, credentialScopeFor(url)) : null
  }
  // Nothing sent: the renderer holds no tokens until Settings is opened, and
  // never a link. So the profile's own credential is resolved here — its PAT,
  // else the machine login it linked (the GitHub CLI's account, or one git's
  // helper holds) — the way push resolves it (`remoteCredential`). Without
  // this, git's own helper would pick whichever account it likes. A cloud host
  // with no profile named keeps cloning anonymously, as before.
  if (!selfHosted && profileId === undefined) return null
  const repoHost = host as RepoHost
  const input =
    profileId !== undefined ? await namedProfileAuth(repoHost, profileId, url) : await activeProfileAuth(repoHost, url)
  const found = await apiToken(url, input).catch(() => null)
  if (!found) return null
  const auth = found.cred ?? basicAuthFor(repoHost, found.token, url, found.gitUsername, found.gitTokenKind)
  return auth ? gitCredentialEnv(url, auth, process.env, credentialScopeFor(url)) : null
}

/**
 * simple-git refuses an `.env()` that names a credential helper or carries
 * `GIT_CONFIG_COUNT` — and, since it scans the whole object, any inherited
 * variable such as `GIT_ASKPASS` or `PAGER`. The helper is ours and the rest is
 * the app's own environment, which every `runGit` child inherits anyway. The
 * argument checks (`--upload-pack`, `-u`) stay on.
 */
const CLONE_ENV_UNSAFE = {
  allowUnsafeCredentialHelper: true,
  allowUnsafeConfigEnvCount: true,
  allowUnsafeAskPass: true,
  allowUnsafeConfigPaths: true,
  allowUnsafeDiffExternal: true,
  allowUnsafeEditor: true,
  allowUnsafeGitProxy: true,
  allowUnsafePager: true,
  allowUnsafeSshCommand: true,
  allowUnsafeTemplateDir: true
}

/**
 * The simple-git instance a clone runs on, with `env` as its whole environment:
 * the app's own — which carries the user's GIT_SSH_COMMAND or proxy, as fetch
 * and push get — plus the profile's credential when there is one. simple-git ≥ 4
 * drops every git-related variable it inherits and refuses one handed to
 * `.env()` unless it is named in allowEnvironment; without that, an EDITOR or
 * GIT_EDITOR in the environment failed every signed-in clone before it started.
 */
export function cloneGit(
  parentDir: string,
  env: NodeJS.ProcessEnv,
  onProgress?: (p: CloneProgress) => void,
  abort?: AbortSignal
): SimpleGit {
  const git = simpleGit({
    baseDir: parentDir,
    abort,
    progress: onProgress
      ? ({ stage, progress, processed, total }) => onProgress({ stage, progress, processed, total })
      : undefined,
    unsafe: CLONE_ENV_UNSAFE,
    // A credential's `useHttpPath` entry, which rides in the environment.
    allowConfig: ['credential.*.usehttppath'],
    allowEnvironment: Object.keys(env).filter((k) => isGuardedEnvKey(k))
  })
  git.env(env)
  return git
}

/** Clones still running, by the renderer's `cloneId` — what `cancelClone` aborts.
 *  Clones run in the background now, so the dialog closing no longer ends one;
 *  this is the only way to stop a clone of the wrong repository. */
const runningClones = new Map<string, AbortController>()

/** On quit: stop every clone rather than leave git running with no window to report to. */
export function abortAllClones(): void {
  for (const controller of runningClones.values()) controller.abort()
}

/** Map a remote URL's hostname to the provider whose PAT can authenticate it. */
export function hostFromUrl(url: string): RepoHost | undefined {
  // Exact host or a dotted subdomain of a known provider: `github.evil.com` or
  // `notgithub.com` must never be offered the profile's token. A configured
  // server by its full base, so a Data Center beside a GitLab on one hostname
  // is still the Data Center (`resolveRemoteProvider`).
  return providerOfRemote(url)
}

/**
 * Repositories whose `git log` with signature placeholders failed while the
 * same log without them worked — a broken gpg config (see `log`). Remembered so
 * each page does not run the failing command first; retried after the TTL, so
 * fixing `~/.gitconfig` brings the signature badges back without a restart.
 */
const unsignedLogRepos = new Map<string, number>()
const UNSIGNED_LOG_TTL_MS = 10 * 60 * 1000

/** Whether the graph is currently being read without signature verification. */
export function logSignaturesDisabled(repoPath: string): boolean {
  const since = unsignedLogRepos.get(repoPath)
  return since !== undefined && Date.now() - since < UNSIGNED_LOG_TTL_MS
}

// Disable git's interactive credential prompt for network ops run from the app.
// Electron has no controlling TTY, so a prompt fails with the opaque macOS error
// "could not read Password … Device not configured". With this set, a missing
// credential surfaces immediately as a clear "could not read Username/Password"
// (terminal prompts disabled) error instead of hanging on /dev/tty.
/**
 * The environment for git commands the app runs and reads back.
 *
 * `LANGUAGE=en` keeps git's own messages in English whatever the system locale:
 * the app recognises them by text (the error-toast hints, the non-fast-forward
 * and stale-lock dialogs), and a translated "could not read Username" matched
 * none of that. gettext gives LANGUAGE priority over LC_ALL/LANG for messages
 * only, so character encoding and dates stay as the user has them. The UI is
 * translated by the app; git's raw text is what "details" and bug reports show.
 */
/** How long the pull-request dialog waits for its base branch to refresh before comparing with what it has. */
const PR_BASE_FETCH_TIMEOUT_MS = 10_000

export const noPromptEnv = (): NodeJS.ProcessEnv => ({ ...process.env, GIT_TERMINAL_PROMPT: '0', LANGUAGE: 'en' })

/**
 * Strip `user:secret@` out of every URL in a message, and the bare token
 * shapes the hosts issue (see shared/redact.ts).
 *
 * Git echoes the remote URL back in its errors, and a clone or a clone-dialog
 * a URL the user pasted with `user:token@` in it is echoed as-is — so without
 * this an unlucky failure prints the token into the UI, the operation log, and
 * any screenshot of either. A legacy `.git/config` with a token in its remote
 * URL is caught the same way.
 */
export function redactCredentials(msg: string): string {
  return redactSecrets(msg)
}

/**
 * Refuse a remote name, URL or ref that git would parse as an option.
 *
 * These arrive from the renderer, from a hosting server's API (a clone_url) or
 * from a pasted string, and git's option parser permutes: `--upload-pack=<cmd>`
 * is an option wherever it sits in the argument list, and it runs `<cmd>`. No
 * real remote, URL or branch starts with `-`, so refusing costs nothing. Call
 * sites also put `--` before their positionals; this is the second line, for
 * commands such as `git subtree` that forward their arguments onward.
 */
export function assertNotOption(value: string | undefined, what: string): void {
  if (typeof value === 'string' && /^\s*-/.test(value)) {
    throw new Error(`Refusing ${what} "${value}": it starts with "-", so git would read it as an option.`)
  }
}

/**
 * The shape a branch name from outside (a hosting API) must have before it goes
 * into a refspec. Checked in JS first, so a hostile name is refused without
 * running anything: `-` would be an option, `:` and `+` rewrite the refspec,
 * `..`, whitespace and `@{` are rejected by git anyway but `@{-1}` would be
 * *expanded* by `check-ref-format --branch` inside a repository.
 */
export function isPlainBranchName(name: string): boolean {
  if (!name || name.length > 255) return false
  if (name.startsWith('-') || name.startsWith('+') || name.startsWith('/') || name.endsWith('/')) return false
  if (/[\s:\x00-\x1f\x7f~^?*[\\]/.test(name)) return false
  if (name.includes('..') || name.includes('@{') || name.includes('//')) return false
  if (name === '@' || name === 'HEAD' || name.endsWith('.lock') || name.endsWith('.')) return false
  return true
}

/**
 * Refuse a remote/branch pair that is not a configured remote and a valid
 * branch name. git's own `check-ref-format --branch` has the last word, and
 * must hand the name back unchanged — a rewritten name is not the one asked for.
 */
async function assertSafeRemoteBranch(repoPath: string, remote: string, branch: string): Promise<void> {
  if (!isPlainBranchName(branch)) throw new Error(`Refusing the branch name "${branch}": it is not a plain branch name.`)
  assertNotOption(remote, 'the remote')
  const normalized = await runGit(repoPath, ['check-ref-format', '--branch', branch]).catch(() => '')
  if (normalized.trim() !== branch) throw new Error(`Refusing the branch name "${branch}": git does not accept it.`)
  await assertConfiguredRemote(repoPath, remote)
}

/** A file changing more lines than this is listed, not diffed — see getCommitRangeFiles. */
export const RANGE_FILE_LINE_CAP = 20_000
/** The whole range's diff output, with every over-cap file already left out. */
const RANGE_DIFF_MAX_BUFFER = 512 << 20
/** Files git calls binary that are read again as bytes, and how big each may be. */
const RANGE_BINARY_REREADS = 50
const RANGE_BLOB_MAX_BYTES = 2 << 20

type NumstatEntry = { path: string; oldPath?: string; additions: number; deletions: number; binary: boolean }

/**
 * `git diff --numstat -z`: `added<TAB>deleted<TAB>path<NUL>`, or for a rename
 * `added<TAB>deleted<TAB><NUL>old<NUL>new<NUL>`; `-` and `-` for a binary file.
 */
export function parseNumstatZ(out: string): NumstatEntry[] {
  const parts = out.split('\0')
  const entries: NumstatEntry[] = []
  for (let i = 0; i < parts.length; i++) {
    const m = /^(-|\d+)\t(-|\d+)\t([\s\S]*)$/.exec(parts[i])
    if (!m) continue
    const binary = m[1] === '-' && m[2] === '-'
    const base = { additions: binary ? 0 : Number(m[1]), deletions: binary ? 0 : Number(m[2]), binary }
    if (m[3]) entries.push({ path: m[3], ...base })
    else if (i + 2 < parts.length) {
      entries.push({ path: parts[i + 2], oldPath: parts[i + 1], ...base })
      i += 2
    }
  }
  return entries
}

/** The over-cap files of a range, with their counts and status but no patch. */
async function largeRangeFiles(repoPath: string, from: string, to: string, large: NumstatEntry[]): Promise<PrFile[]> {
  const spec = large.flatMap((c) => (c.oldPath ? [c.oldPath, c.path] : [c.path])).map((p) => `:(top,literal)${p}`)
  const raw = await runGit(repoPath, ['diff', '--name-status', '-z', '--no-ext-diff', '-M', from, to, '--', ...spec], {
    GIT_NO_LAZY_FETCH: '1'
  }).catch(() => '')
  const statusOf = new Map<string, string>()
  const parts = raw.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i][0]
    if (!code) continue
    if (code === 'R' || code === 'C') {
      statusOf.set(parts[i + 2], 'renamed')
      i += 2
    } else {
      statusOf.set(parts[i + 1], code === 'A' ? 'added' : code === 'D' ? 'removed' : 'modified')
      i += 1
    }
  }
  return large.map((c) => ({
    filename: c.path,
    status: c.oldPath ? 'renamed' : (statusOf.get(c.path) ?? 'modified'),
    additions: c.additions,
    deletions: c.deletions,
    noPatchReason: 'tooLarge' as const,
    ...(c.oldPath ? { previousFilename: c.oldPath } : {})
  }))
}

/** One blob's bytes, or null when it is not here or is over RANGE_BLOB_MAX_BYTES. */
async function readBlobBytes(repoPath: string, rev: string, path: string): Promise<Uint8Array | null> {
  try {
    const { stdout } = await pexecFile('git', ['-C', repoPath, 'cat-file', 'blob', `${rev}:${path}`], {
      env: { ...noPromptEnv(), GIT_NO_LAZY_FETCH: '1' },
      encoding: 'buffer',
      maxBuffer: RANGE_BLOB_MAX_BYTES
    })
    return new Uint8Array(stdout)
  } catch {
    return null
  }
}

/**
 * git calls a file binary on a NUL byte in its first 8000 — which every UTF-16
 * file has. Read the first RANGE_BINARY_REREADS such files as bytes and diff
 * the ones that are text after all, in place.
 */
async function rereadBinaryAsText(repoPath: string, from: string, to: string, files: PrFile[]): Promise<void> {
  const binary = files.filter((f) => f.noPatchReason === 'binary').slice(0, RANGE_BINARY_REREADS)
  const EMPTY = { kind: 'text', text: '' } as const
  for (const f of binary) {
    const [before, after] = await Promise.all([
      f.status === 'added' ? new Uint8Array() : readBlobBytes(repoPath, from, f.previousFilename ?? f.filename),
      f.status === 'removed' ? new Uint8Array() : readBlobBytes(repoPath, to, f.filename)
    ])
    if (!before || !after) continue
    const result = diffFileVersions(
      before.length ? decodeFileBytes(before) : EMPTY,
      after.length ? decodeFileBytes(after) : EMPTY
    )
    if (!result.patch) continue
    delete f.noPatchReason
    Object.assign(f, result)
  }
}

/**
 * A gitService call made from elsewhere in the main process (the pull request
 * Files tab's local-first read), under the same per-repository read/write lock
 * the IPC dispatcher takes — a fetch here must not run beside a commit there.
 */
export async function withRepoLock<T>(repoPath: string, method: string, op: () => Promise<T>): Promise<T> {
  const isWrite = !gitMethodIsRead(method)
  if (isWrite) await shellPathReady()
  const release = await lockFor(repoPath).acquire(isWrite)
  try {
    return await withLockRetry(op)
  } finally {
    release()
  }
}

/** Where fetchPrHead keeps fork pull request heads: `<prefix><remote>/<number>`. */
const PR_HEAD_REF_PREFIX = 'refs/githuttbr/pr/'

/** `remote` is one of this repository's remotes — never an option, a URL or a path. */
async function assertConfiguredRemote(repoPath: string, remote: string): Promise<void> {
  assertNotOption(remote, 'the remote')
  const remotes = (await runGit(repoPath, ['remote'])).split('\n').map((s) => s.trim())
  if (!remotes.includes(remote)) throw new Error(`Refusing the remote "${remote}": it is not configured in this repository.`)
}

/**
 * The first of `candidates` that `remote` publishes, with its sha — one
 * `ls-remote` for all of them. Candidate order is priority order.
 */
async function probePrRef(repoPath: string, remote: string, candidates: PrRefCandidate[]): Promise<PrRefProbe | null> {
  if (!candidates.length) return null
  const out = await withRemoteAuth(repoPath, remote, 'fetch', () =>
    runGit(repoPath, ['ls-remote', '--', remote, ...candidates.map((c) => c.ref)])
  )
  const found = new Map<string, string>()
  for (const line of out.split('\n')) {
    const [sha, ref] = line.split('\t')
    if (sha && ref) found.set(ref.trim(), sha.trim())
  }
  for (const c of candidates) {
    const sha = found.get(c.ref)
    if (sha) return { ...c, sha }
  }
  return null
}

/**
 * Run a git command non-interactively, surfacing stderr as the thrown message.
 *
 * Prefer this over `gitFor(repo).raw(...)` on any read a refresh performs.
 * simple-git's completion-detection plugin sleeps a flat 50ms after a command
 * that wrote nothing to stdout or stderr, to guard against output arriving
 * after `close` on some platforms. `execFile` already waits for stdio EOF, so
 * it does not need the guard — and it is exactly the *clean* repo, where the
 * reads return nothing, that pays the 50ms per call otherwise.
 */
/**
 * The `a/` and `b/` path prefixes, whatever the user's config says. A patch read
 * by the app — split into files, its paths parsed, or fed back to `git apply` —
 * assumes them; `diff.noprefix` or `diff.mnemonicPrefix` (`i/`, `w/`, `c/`)
 * would otherwise make added and binary files vanish, or a hunk not apply.
 */
const DIFF_PREFIXES = ['--src-prefix=a/', '--dst-prefix=b/']

async function runGit(
  repoPath: string,
  args: string[],
  extraEnv?: NodeJS.ProcessEnv,
  maxBuffer?: number,
  timeoutMs?: number
): Promise<string> {
  try {
    const { stdout } = await pexecFile('git', ['-C', repoPath, ...args], {
      // Inside withRemoteAuth, the profile's credential rides along (see gitCredentialEnv).
      env: { ...noPromptEnv(), ...(remoteAuthEnv.getStore() ?? {}), ...(extraEnv ?? {}) },
      ...(maxBuffer ? { maxBuffer } : {}),
      ...(timeoutMs ? { timeout: timeoutMs } : {})
    })
    return stdout
  } catch (err) {
    const e = err as { stderr?: string; message?: string }
    throw new Error(redactCredentials((e.stderr || e.message || 'git command failed').trim()))
  }
}

/**
 * runGit for a command whose stdout still matters when it fails: `git push
 * --porcelain` exits non-zero as soon as one ref is rejected, and the per-ref
 * report is exactly what the caller needs then.
 */
async function runGitCapture(
  repoPath: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await pexecFile('git', ['-C', repoPath, ...args], {
      env: { ...noPromptEnv(), ...(remoteAuthEnv.getStore() ?? {}) }
    })
    return { stdout, stderr, code: 0 }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number | string; message?: string }
    return {
      stdout: e.stdout ?? '',
      stderr: redactCredentials(e.stderr || e.message || 'git command failed'),
      code: typeof e.code === 'number' ? e.code : 1
    }
  }
}

function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}([0-9a-f]{24})?$/.test(value)
}

/**
 * `rel` resolved inside the repository, or null when it escapes it — through
 * `..` or through a symlinked parent directory. The leaf itself may be a
 * symlink: removing it removes the link, not its target.
 */
async function containedPath(repoPath: string, rel: string): Promise<string | null> {
  const root = await realpath(repoPath).catch(() => resolvePath(repoPath))
  const full = resolvePath(root, rel)
  if (!full.startsWith(root + sep)) return null
  const parent = await realpath(dirname(full)).catch(() => null)
  if (parent === null) return full
  return parent === root || parent.startsWith(root + sep) ? full : null
}

/**
 * Paths out of a batched `ls-*` probe that git knows, parsed from -z output.
 * Probes are read-only and answer for every pathspec in one spawn — the cheap
 * classifier behind discard/restore batching (each spawned git costs tens of
 * ms, so per-file probes would defeat the point). `--literal-pathspecs` keeps
 * file names with glob characters from matching their neighbors.
 */
async function probePaths(repoPath: string, args: string[]): Promise<Set<string>> {
  const out = await runGit(repoPath, ['--literal-pathspecs', ...args]).catch(() => '')
  return new Set(out.split('\0').filter(Boolean))
}

/**
 * Does a pathspec — usually a file, but the UI also hands over folder prefixes
 * like `dir/` — cover anything in a probe result? A folder prefix never
 * appears verbatim in `ls-files`/`ls-tree` output; its children do.
 */
function pathspecMatches(set: Set<string>, pathspec: string): boolean {
  if (set.has(pathspec)) return true
  const prefix = pathspec.endsWith('/') ? pathspec : `${pathspec}/`
  for (const p of set) if (p.startsWith(prefix)) return true
  return false
}

/** restoreWork for a single path — the fallback when a batched restore fails. */
async function restoreWorkPath(repoPath: string, saved: SavedWork, path: string): Promise<void> {
  const full = await containedPath(repoPath, path)
  if (!full) throw new Error(`Refusing to restore outside the repository: ${path}`)
  // A path staged neither then nor now matches nothing, which git reports
  // as an error; there is simply nothing to put back in the index.
  await runGit(repoPath, ['--literal-pathspecs', 'restore', '--source', saved.index, '--staged', '--', path])
    .catch((err: Error) => {
      if (!/did not match/i.test(err.message)) throw err
    })
  const existed = (
    await runGit(repoPath, ['--literal-pathspecs', 'ls-tree', '--name-only', saved.worktree, '--', path])
  ).trim()
  if (existed) {
    await runGit(repoPath, ['--literal-pathspecs', 'restore', '--source', saved.worktree, '--worktree', '--', path])
  } else {
    await rm(full, { force: true }).catch(() => {})
  }
}

/**
 * Discard one tracked path — the fallback when a batched checkout fails.
 * Per-file so one tricky path doesn't fail the rest:
 *  1. `checkout -- f` restores a modified file from the index (keeps staged
 *     changes — the common case, unchanged behavior).
 *  2. staged deletions/renames aren't in the index, so fall back to
 *     `checkout HEAD -- f` to bring the file back from the last commit.
 *  3. staged-new files don't exist in HEAD either, so drop them from the
 *     index and disk with `rm -f`.
 */
async function discardOne(repoPath: string, f: string): Promise<void> {
  const git = gitFor(repoPath)
  try {
    await git.raw(['checkout', '--', f])
    return
  } catch {
    /* not in index — try HEAD */
  }
  try {
    await git.raw(['checkout', 'HEAD', '--', f])
    return
  } catch {
    /* not in HEAD — staged-new */
  }
  // Staged-new: out of the index and off the disk. When it is no longer in
  // the index either (Discard all unstages first), it is a file git never
  // had — remove it the way discarding an untracked file would.
  const rmError = await git.raw(['rm', '-f', '--', f]).then(() => null, (err: Error) => err)
  if (!rmError) return
  // Only a path git truly does not know is deleted by hand. Anything else
  // (a held index.lock, a path still in the index or in HEAD) is a real
  // failure, and wiping the file from disk would lose it for good.
  const known = async (args: string[]): Promise<boolean> =>
    runGit(repoPath, args).then(() => true, () => false)
  if (
    (await known(['--literal-pathspecs', 'ls-files', '--error-unmatch', '--', f])) ||
    (await known(['cat-file', '-e', `HEAD:${f}`]))
  ) {
    throw rmError
  }
  const full = await containedPath(repoPath, f)
  if (!full) throw new Error(`Refusing to delete outside the repository: ${f}`)
  await rm(full, { force: true })
}

/**
 * Undo the initial commit: leave an unborn branch, keep the working tree,
 * unstage everything. Deleted worktree files are restored first so they are
 * not lost when the index is emptied.
 */
async function undoRootCommit(repoPath: string): Promise<void> {
  const status = await gitService.status(repoPath)
  const deleted = [...status.unstaged, ...status.staged]
    .filter((f) => f.status === 'D')
    .map((f) => f.path)
  if (deleted.length) {
    await runGit(repoPath, ['checkout', 'HEAD', '--', ...deleted]).catch(() => undefined)
  }
  await runGit(repoPath, ['update-ref', '-d', 'HEAD'])
  await runGit(repoPath, ['rm', '-r', '--cached', '-q', '.']).catch(() => undefined)
}

// ─── WIP snapshot plumbing (see the gitService section for the full story) ───

const SNAPSHOT_SUFFIX: Record<SnapshotKind, string> = { auto: '-a', manual: '-m', guard: '-g' }

function kindForSnapshotRef(ref: string): SnapshotKind {
  return ref.endsWith('-a') ? 'auto' : ref.endsWith('-g') ? 'guard' : 'manual'
}

/** Snapshot refs, newest first. Cheap: one for-each-ref, no per-ref subprocesses. */
async function listSnapshotRefs(repoPath: string): Promise<{ ref: string; sha: string; time: number }[]> {
  // NB: for-each-ref does NOT interpret %xHH hex escapes (that's a git-log
  // pretty-format feature). refname/sha/unixtime contain no spaces, so a plain
  // space is a safe field separator here.
  const raw = await gitFor(repoPath)
    .raw([
      'for-each-ref',
      '--sort=-creatordate',
      '--format=%(refname) %(objectname) %(creatordate:unix)',
      // Snapshots taken before the rename live under refs/gitcito/wip and are
      // listed, restored and pruned exactly like new ones.
      ...APP_IDS.map(snapshotRefRoot)
    ])
    .catch(() => '')
  const out: { ref: string; sha: string; time: number }[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    const [ref, sha, time] = line.split(' ')
    out.push({ ref, sha, time: Number(time) })
  }
  return out
}

/**
 * Best-effort snapshot taken right before a destructive operation, so the state
 * about to be destroyed stays recoverable. Never blocks the operation: every
 * failure here is swallowed — the guard is a parachute, not a gate.
 */
async function guardSnapshot(repoPath: string): Promise<void> {
  try {
    const settings = await readSettings()
    if (settings.snapshotGuard === false) return
    await gitService.createSnapshot(repoPath, 'guard')
  } catch {
    /* the operation must not be blocked by its own parachute */
  }
}

/**
 * The file as it was before and after each three-way hunk merge, by id. A merge
 * is not a patch: reversing it with `git apply` misses (the patch never applied
 * as is) and merging the reverse again can stack conflict markers on markers.
 * Undo and redo put back these exact bytes instead. Kept for the session only,
 * and only the latest few, like the undo stack that refers to them.
 */
const hunkMerges = new Map<string, { repoPath: string; file: string; before: Buffer; after: Buffer }>()
const HUNK_MERGES_KEPT = 50

function rememberHunkMerge(repoPath: string, file: string, before: Buffer, after: Buffer): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  hunkMerges.set(id, { repoPath, file, before, after })
  if (hunkMerges.size > HUNK_MERGES_KEPT) hunkMerges.delete(hunkMerges.keys().next().value as string)
  return id
}

/**
 * The three-way fallback behind `applyHunkPatch` for the working tree.
 *
 * The patch's `index <old>..<new>` line names the exact file it was cut from.
 * That version is the merge base; the same version with the patch applied is
 * "theirs"; the working copy is "ours". `git merge-file` then keeps both sets
 * of changes: lines that do not overlap merge cleanly, lines that do get
 * conflict markers in the file — the same outcome a cherry-pick or revert of a
 * whole commit would have, scoped to one hunk.
 *
 * Returns null when the fallback cannot run (a blob git no longer has, a new
 * or deleted file, a patch that does not even fit its own base), so the caller
 * reports the original `git apply` error instead.
 */
async function mergeHunkIntoFile(
  repoPath: string,
  patch: string,
  patchFile: string,
  reverse: boolean,
  ignoreWhitespace: boolean
): Promise<{ conflicts: number; merge: string } | null> {
  // Git appends a tab to a `+++` name holding a space, and quotes one holding
  // anything unusual; the quoted form is left to the plain `git apply` error.
  const file = /^\+\+\+ b\/(.+)$/m.exec(patch)?.[1]?.replace(/\t$/, '')
  const blobs = /^index ([0-9a-f]+)\.\.([0-9a-f]+)/m.exec(patch)
  if (!file || !blobs || file.startsWith('"') || isAbsolute(file) || file.split('/').includes('..')) return null
  // Reversed, the patch is undone from its new side; forwards, applied to its old.
  const baseBlob = reverse ? blobs[2] : blobs[1]
  if (/^0+$/.test(baseBlob)) return null
  // The patch text comes from the renderer: the file it names must sit inside
  // the repository and be a regular file, never a symlink we would write through.
  const oursPath = await containedPath(repoPath, file)
  if (!oursPath) return null
  if (!(await lstat(oursPath).catch(() => null))?.isFile()) return null

  const dir = await mkdtemp(join(tmpdir(), 'githuttbr-merge-'))
  try {
    // Bytes, and through the file's filters (eol, LFS smudge), so the base is
    // in the same form as the working copy it is merged with. A patch that then
    // no longer fits — CRLF on disk, an LFS pointer diff — falls back to the
    // plain error rather than rewriting the file in the wrong form.
    const base = await pexecFile('git', ['-C', repoPath, 'cat-file', '--filters', `--path=${file}`, baseBlob], {
      env: noPromptEnv(),
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024
    }).then(
      ({ stdout }) => stdout,
      () => null
    )
    if (base === null) return null
    // Outside a repository `git apply` patches plain files relative to cwd —
    // here, a scratch copy of the base at the patch's own path.
    const theirsPath = join(dir, file)
    await mkdir(dirname(theirsPath), { recursive: true })
    await writeFile(theirsPath, base)
    const applyArgs = [
      'apply',
      '--whitespace=nowarn',
      ...(reverse ? ['--reverse'] : []),
      ...(ignoreWhitespace ? ['--ignore-whitespace'] : []),
      patchFile
    ]
    const applied = await pexecFile('git', applyArgs, { cwd: dir, env: noPromptEnv() }).then(
      () => true,
      () => false
    )
    if (!applied) return null
    const basePath = join(dir, '.githuttbr-merge-base')
    await writeFile(basePath, base)

    // merge-file exits with the number of conflicts, so a non-zero exit with
    // output is a result, not a failure. Labels are what the conflict markers say.
    const result = await pexecFile(
      'git',
      ['merge-file', '-p', '-L', 'working copy', '-L', 'base', '-L', 'hunk', oursPath, basePath, theirsPath],
      { env: noPromptEnv(), encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }
    ).then(
      ({ stdout }) => ({ stdout, conflicts: 0 }),
      (err: { stdout?: unknown; code?: number }) =>
        typeof err.code === 'number' && err.code > 0 && err.code < 128 && Buffer.isBuffer(err.stdout)
          ? { stdout: err.stdout, conflicts: err.code }
          : null
    )
    if (!result) return null
    // Nothing moved — the hunk is already undone (or applied) in the working
    // copy, e.g. a second click. Reporting success would claim a change that
    // never happened; returning null surfaces git's own "does not apply".
    const before = await readFile(oursPath)
    if (result.stdout.equals(before)) return null
    await writeFile(oursPath, result.stdout)
    return { conflicts: result.conflicts, merge: rememberHunkMerge(repoPath, file, before, result.stdout) }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

// ─── Commit-edit plumbing (see the gitService section for the full story) ───

/** Read a blob at `<sha>:<file>` as a raw Buffer (git show, no encoding loss). */
function readBlobBuffer(repoPath: string, spec: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn('git', ['-C', repoPath, 'show', spec], { env: noPromptEnv() })
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    child.stdout.on('data', (d: Buffer) => chunks.push(d))
    child.stderr.on('data', (d: Buffer) => errChunks.push(d))
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks))
        : reject(new Error(Buffer.concat(errChunks).toString() || `git show exited ${code}`))
    )
  })
}

/**
 * Cherry-pick `commit` onto `onto` entirely in memory: merge-tree with the
 * commit's own parent as the explicit base, so only the commit's patch moves.
 * Exit 1 (conflict) is a result, not an error.
 */
async function cherryPickTree(
  repoPath: string,
  base: string,
  onto: string,
  commit: string
): Promise<MergeTreeRecord> {
  const args = ['-C', repoPath, 'merge-tree', '--write-tree', '--name-only', '--messages', `--merge-base=${base}`, onto, commit]
  try {
    const { stdout } = await pexecFile('git', args, { env: noPromptEnv(), maxBuffer: 16 * 1024 * 1024 })
    return parseMergeTreeSingle(stdout, 0)
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string; message?: string }
    const code = typeof e.code === 'number' ? e.code : 2
    return parseMergeTreeSingle(e.stdout ?? '', code, e.stderr || e.message || '')
  }
}

/** Author identity + full message of one commit, for faithful rewrites. */
async function commitIdentity(
  repoPath: string,
  sha: string
): Promise<{ name: string; email: string; date: string; message: string }> {
  const raw = await runGit(repoPath, ['log', '-1', '--format=%an%x00%ae%x00%aI%x00%B', sha])
  const [name, email, date, ...rest] = raw.split('\x00')
  return { name, email, date, message: rest.join('\x00').replace(/\n+$/, '') }
}

/** Env that re-commits as the original author (committer stays the local user). */
function authorEnv(id: { name: string; email: string; date: string }): NodeJS.ProcessEnv {
  return { GIT_AUTHOR_NAME: id.name, GIT_AUTHOR_EMAIL: id.email, GIT_AUTHOR_DATE: id.date }
}

/**
 * The engine under commit editing: build a replacement for `sha` with edited
 * file contents and/or a new message, then replay every descendant up to HEAD
 * on top of it — all with plumbing (temp index, hash-object, commit-tree,
 * in-memory merge-tree). No ref moves, no worktree writes: the caller decides
 * whether the resulting tip becomes real. Dangling objects from a discarded
 * preview are ordinary gc food.
 */
async function rewriteWithEdits(
  repoPath: string,
  sha: string,
  edits: Record<string, string>,
  message: string
): Promise<CommitEditPreview> {
  const gitDir = (await runGit(repoPath, ['rev-parse', '--absolute-git-dir'])).trim()
  const stamp = `${process.pid}-${Date.now()}`
  const tmpIndex = join(gitDir, `githuttbr-edit-index-${stamp}`)
  const tmpBlob = join(gitDir, `githuttbr-edit-blob-${stamp}`)
  const env = { GIT_INDEX_FILE: tmpIndex }
  try {
    // 1. The edited commit's replacement tree.
    await runGit(repoPath, ['read-tree', `${sha}^{tree}`], env)
    for (const [file, content] of Object.entries(edits)) {
      const entry = (await runGit(repoPath, ['ls-tree', sha, '--', file])).trim()
      const mode = entry.split(' ')[0]
      if (mode !== '100644' && mode !== '100755') throw new Error(`Not an editable file in this commit: ${file}`)
      await writeFile(tmpBlob, content, 'utf-8')
      const blob = (await runGit(repoPath, ['hash-object', '-w', '--', tmpBlob])).trim()
      await runGit(repoPath, ['update-index', '--add', '--cacheinfo', `${mode},${blob},${file}`], env)
    }
    const newTree = (await runGit(repoPath, ['write-tree'], env)).trim()

    // 2. Replacement commit, same parents and author, possibly a new message.
    const parentLine = (await runGit(repoPath, ['rev-list', '--parents', '-n', '1', sha])).trim().split(' ')
    const parents = parentLine.slice(1).flatMap((p) => ['-p', p])
    const id = await commitIdentity(repoPath, sha)
    let tip = (
      await runGit(repoPath, ['commit-tree', newTree, ...parents, '-m', message || id.message], authorEnv(id))
    ).trim()

    // 3. Replay descendants oldest → newest, parent-aware. Every affected
    //    commit — one whose parents were rewritten — is re-created:
    //
    //    - An ordinary commit is an in-memory cherry-pick relative to its own
    //      first parent (merge-tree, no worktree).
    //    - A MERGE commit is replayed the same way: its recorded tree already
    //      contains both sides *and the conflict resolutions its author made*,
    //      so cherry-picking that result onto the rewritten first parent
    //      carries the resolutions verbatim — no rerere, no re-merge. All
    //      parent pointers are preserved, mapped through the rewrite.
    //
    //    Side-branch commits inside `sha..HEAD` that don't descend from the
    //    edited commit are untouched. The first conflict stops the cascade and
    //    marks the affected remainder.
    const range = (await runGit(repoPath, ['log', '--reverse', '--topo-order', '--format=%H%x00%P%x00%s', `${sha}..HEAD`]))
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [h, p, ...s] = l.split('\x00')
        return { sha: h, parents: p.split(' ').filter(Boolean), subject: s.join('\x00') }
      })
    const steps: CommitEditStep[] = []
    const rewritten = new Map<string, string>([[sha, tip]])
    // Commits that would have been rewritten but sit behind a conflict.
    const stuck = new Set<string>()
    let conflicted = false
    for (const c of range) {
      const touchesStuck = c.parents.some((p) => stuck.has(p))
      const mapped = c.parents.map((p) => rewritten.get(p) ?? p)
      const affected = touchesStuck || mapped.some((p, i) => p !== c.parents[i])
      if (!affected) continue // side-branch commit — keeps its identity
      const isMerge = c.parents.length > 1
      if (conflicted) {
        stuck.add(c.sha)
        steps.push({ sha: c.sha, subject: c.subject, status: 'blocked', files: [], ...(isMerge ? { merge: true } : {}) })
        continue
      }
      const rec = await cherryPickTree(repoPath, c.parents[0], mapped[0], c.sha)
      if (rec.status !== 'clean') {
        conflicted = true
        stuck.add(c.sha)
        steps.push({ sha: c.sha, subject: c.subject, status: 'conflict', files: rec.files, ...(isMerge ? { merge: true } : {}) })
        continue
      }
      const cid = await commitIdentity(repoPath, c.sha)
      const parentArgs = mapped.flatMap((p) => ['-p', p])
      const next = (await runGit(repoPath, ['commit-tree', rec.tree, ...parentArgs, '-m', cid.message], authorEnv(cid))).trim()
      rewritten.set(c.sha, next)
      steps.push({ sha: c.sha, subject: c.subject, status: 'clean', files: [], ...(isMerge ? { merge: true } : {}) })
    }
    const headSha = (await runGit(repoPath, ['rev-parse', 'HEAD'])).trim()
    const newTip = conflicted ? null : (rewritten.get(headSha) ?? null)
    return { newTip, steps }
  } finally {
    await unlink(tmpIndex).catch(() => {})
    await unlink(tmpBlob).catch(() => {})
  }
}

/**
 * What stands between `sha` and HEAD. Editing needs only ancestry — merges in
 * the range are replayed with their recorded resolutions, so they inform the
 * UI rather than disable the feature.
 */
async function commitEditRange(repoPath: string, sha: string): Promise<{ ancestor: boolean; merges: number }> {
  const ancestor = await runGit(repoPath, ['merge-base', '--is-ancestor', sha, 'HEAD']).then(
    () => true,
    () => false
  )
  if (!ancestor) return { ancestor: false, merges: 0 }
  const merges = (await runGit(repoPath, ['rev-list', '--merges', '--count', `${sha}..HEAD`]).catch(() => '0')).trim()
  return { ancestor: true, merges: parseInt(merges, 10) || 0 }
}

/**
 * Run git with `input` on stdin and hand back whatever it wrote to stdout.
 * A non-zero exit is not an error here: `merge-tree --stdin` aborts the batch
 * on the first fatal merge, and the records it already emitted are still good.
 */
function gitWithStdin(repoPath: string, args: string[], input: string, extraEnv?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('git', ['-C', repoPath, ...args], { env: { ...noPromptEnv(), ...extraEnv } })
    let out = ''
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.on('error', () => resolve(out))
    child.on('close', () => resolve(out))
    child.stdin.on('error', () => undefined)
    child.stdin.end(input)
  })
}

/** One in-memory merge of `ref` into `base`, used to fill gaps left by a batch abort. */
async function singleMergeTree(repoPath: string, base: string, ref: string): Promise<MergeTreeRecord> {
  const args = ['-C', repoPath, 'merge-tree', '--write-tree', '--name-only', '--messages', base, ref]
  try {
    const { stdout } = await pexecFile('git', args, { env: noPromptEnv(), maxBuffer: 16 * 1024 * 1024 })
    return parseMergeTreeSingle(stdout, 0)
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string; message?: string }
    const code = typeof e.code === 'number' ? e.code : 2
    return parseMergeTreeSingle(e.stdout ?? '', code, e.stderr || e.message || '')
  }
}

/** How far back absorb may reach: your unpublished commits, and no further. */
async function absorbCandidates(
  repoPath: string
): Promise<{ commits: { sha: string; subject: string }[]; base: string; label: string }> {
  interface Range {
    commits: { sha: string; subject: string }[]
    base: string
    label: string
  }
  const none: Range = { commits: [], base: '', label: '' }
  const read = async (range: string, label: string, base: string): Promise<Range | null> => {
    const out = await runGit(repoPath, ['log', `--format=%H${SEP}%s`, range]).catch(() => '')
    const commits = out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, subject] = line.split(SEP)
        return { sha, subject: subject ?? '' }
      })
    return commits.length ? { commits, base, label } : null
  }

  // Preferred: everything the upstream branch doesn't have yet.
  const upstream = await runGit(repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
    .then((o) => o.trim())
    .catch(() => '')
  if (upstream) {
    const found = await read(`${upstream}..HEAD`, `unpushed (${upstream}..HEAD)`, upstream)
    if (found) return found
  }

  // No upstream: fall back to the commits this branch added on top of the trunk.
  for (const trunk of ['origin/main', 'origin/master', 'main', 'master']) {
    const base = await runGit(repoPath, ['merge-base', 'HEAD', trunk])
      .then((o) => o.trim())
      .catch(() => '')
    if (!base) continue
    const found = await read(`${base}..HEAD`, `since ${trunk}`, base)
    if (found) return found
  }

  // Brand-new repo with no trunk to compare against: offer the recent commits.
  const found = await read('-25 HEAD', 'last 25 commits', 'HEAD~25')
  return found ?? none
}

/**
 * Blame the old side of each hunk and hand it to the newest candidate commit
 * that owns any of its lines. Deleted lines are the strong signal; a hunk that
 * only adds falls back to the context around it, which is where the new code
 * is going.
 */
async function attributeHunks(
  repoPath: string,
  diff: string,
  candidates: { sha: string; subject: string }[]
): Promise<{ targets: AbsorbTarget[]; unmatched: AbsorbHunk[] }> {
  // Candidates come newest-first; the index doubles as "how recent".
  const rank = new Map(candidates.map((c, i) => [c.sha, i]))
  const byTarget = new Map<string, AbsorbHunk[]>()
  const unmatched: AbsorbHunk[] = []

  for (const file of parsePatch(diff)) {
    for (const hunk of file.hunks) {
      const entry: AbsorbHunk = {
        file: file.newPath,
        header: hunk.header,
        added: hunk.lines.filter((l) => l.startsWith('+')).length,
        removed: hunk.lines.filter((l) => l.startsWith('-')).length
      }
      // A new or binary file has no history to attribute to.
      if (file.binary || !hunk.oldCount) {
        unmatched.push(entry)
        continue
      }

      const { deleted, context } = touchedOldLines(hunk)
      const lines = deleted.length ? deleted : context
      const owners = await blameOwners(repoPath, file.oldPath, lines)
      let best: string | null = null
      for (const sha of owners) {
        const r = rank.get(sha)
        if (r === undefined) continue
        if (best === null || r < rank.get(best)!) best = sha
      }
      if (!best) {
        unmatched.push(entry)
        continue
      }
      const list = byTarget.get(best)
      if (list) list.push(entry)
      else byTarget.set(best, [entry])
    }
  }

  // Keep the targets in history order (newest first), like the graph shows them.
  const targets: AbsorbTarget[] = candidates
    .filter((c) => byTarget.has(c.sha))
    .map((c) => ({ sha: c.sha, subject: c.subject, hunks: byTarget.get(c.sha)! }))
  return { targets, unmatched }
}

/** Commits that last touched the given lines of a file in HEAD. */
async function blameOwners(repoPath: string, file: string, lines: number[]): Promise<Set<string>> {
  const owners = new Set<string>()
  if (!lines.length) return owners
  // One blame per contiguous run keeps the number of processes down on a hunk
  // that spans many lines.
  for (const [start, end] of contiguousRuns(lines)) {
    const out = await runGit(repoPath, [
      'blame',
      '-w',
      '--porcelain',
      '-L',
      `${start},${end}`,
      'HEAD',
      '--',
      file
    ]).catch(() => '')
    for (const line of out.split('\n')) {
      const m = /^([0-9a-f]{40}) \d+ \d+/.exec(line)
      if (m) owners.add(m[1])
    }
  }
  return owners
}

function contiguousRuns(lines: number[]): [number, number][] {
  const sorted = [...new Set(lines)].sort((a, b) => a - b)
  const runs: [number, number][] = []
  for (const n of sorted) {
    const last = runs[runs.length - 1]
    if (last && n === last[1] + 1) last[1] = n
    else runs.push([n, n])
  }
  return runs
}

async function getRemoteUrl(repoPath: string, remote: string): Promise<string> {
  try {
    const { stdout } = await pexecFile('git', ['-C', repoPath, 'remote', 'get-url', '--', remote])
    return stdout.trim()
  } catch {
    return ''
  }
}

/** The full upstream ref of `branch` (e.g. `origin/main`), or '' when it tracks nothing. */
async function branchUpstream(repoPath: string, branch: string): Promise<string> {
  try {
    const { stdout } = await pexecFile('git', [
      '-C',
      repoPath,
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      `${branch}@{u}`
    ])
    const ref = stdout.trim()
    return ref.includes('/') ? ref : ''
  } catch {
    return ''
  }
}

interface LocalBranchRow {
  name: string
  sha: string
  isCurrent: boolean
  /** `origin/feature`, or null when it tracks nothing. */
  upstream: string | null
  upstreamRemote: string
  /** The upstream's ref on the remote side, `refs/heads/feature`. */
  upstreamRef: string
  track: string
}

/** Every local branch with its upstream tracking, in one `for-each-ref`. */
async function localBranchRows(repoPath: string): Promise<LocalBranchRow[]> {
  // lstrip, not :short — :short disambiguates to `heads/x` when a tag `x` exists.
  const fmt = [
    '%(refname:lstrip=2)',
    '%(objectname)',
    '%(HEAD)',
    '%(upstream:lstrip=2)',
    '%(upstream:remotename)',
    '%(upstream:remoteref)',
    '%(upstream:track)'
  ].join('%00')
  const out = await runGit(repoPath, ['for-each-ref', `--format=${fmt}`, 'refs/heads'])
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, sha, head, upstream, upstreamRemote, upstreamRef, track] = line.split('\0')
      return {
        name,
        sha,
        isCurrent: head === '*',
        upstream: upstream || null,
        upstreamRemote: upstreamRemote ?? '',
        upstreamRef: upstreamRef ?? '',
        track: track ?? ''
      }
    })
}

/**
 * The upstream's branch name on `remote` when it differs from the branch's own
 * name, else null. `git checkout -b feature origin/main` leaves exactly that
 * behind, and sending `feature` there would fast-forward main — which plain
 * `git push` (push.default=simple) refuses, so it is never the default here.
 */
function otherNamedUpstream(row: LocalBranchRow, remote: string): string | null {
  if (row.upstreamRemote !== remote || !row.upstreamRef.startsWith('refs/heads/')) return null
  const name = row.upstreamRef.slice('refs/heads/'.length)
  return name === row.name ? null : name
}

/** Ahead/behind from `%(upstream:track)`, without the `gone` flag leaking into a state object. */
function trackCounts(track: string): { ahead: number; behind: number } {
  const { ahead, behind } = parseUpstreamTrack(track)
  return { ahead, behind }
}

/** The remote's default branch as last fetched (`refs/remotes/<remote>/HEAD`), or null. */
async function remoteDefaultBranch(repoPath: string, remote: string): Promise<string | null> {
  const out = await runGit(repoPath, ['symbolic-ref', '--quiet', `refs/remotes/${remote}/HEAD`]).catch(() => '')
  const prefix = `refs/remotes/${remote}/`
  const ref = out.trim()
  return ref.startsWith(prefix) ? ref.slice(prefix.length) : null
}

/**
 * The default branch the branch cleanup measures against, and the refs that
 * stand for it. The remote's copy comes first: a local main nobody pulled for
 * a month would otherwise hide every merge since. The local one still counts
 * too, so a merge made here and not pushed yet is not mistaken for lost work.
 */
async function cleanupMainRefs(
  repoPath: string,
  localNames: Set<string>,
  remoteRefs: Set<string>,
  remotes: string[]
): Promise<{ mainBranch: string | null; mainRef: string | null; refs: string[] }> {
  const remote = remotes.includes('origin') ? 'origin' : (remotes[0] ?? null)
  const fromRemote = remote ? await remoteDefaultBranch(repoPath, remote) : null
  const mainBranch =
    fromRemote ??
    ['main', 'master'].find((n) => localNames.has(n) || (remote && remoteRefs.has(`refs/remotes/${remote}/${n}`))) ??
    null
  if (!mainBranch) return { mainBranch: null, mainRef: null, refs: [] }
  const remoteRef = remote ? `refs/remotes/${remote}/${mainBranch}` : null
  const refs: string[] = []
  if (remoteRef && remoteRefs.has(remoteRef)) refs.push(remoteRef)
  if (localNames.has(mainBranch)) refs.push(`refs/heads/${mainBranch}`)
  const mainRef = refs.length ? shortCleanupRef(refs[0]) : null
  return { mainBranch, mainRef, refs }
}

/** `refs/remotes/origin/main` → `origin/main`, `refs/heads/main` → `main`. */
function shortCleanupRef(ref: string): string {
  return ref.replace(/^refs\/(remotes|heads)\//, '')
}

/**
 * Branches a rebase is replaying in any worktree. While it runs HEAD is
 * detached, so the branch reads as free; its name is only in
 * `rebase-merge/head-name` or `rebase-apply/head-name` of that worktree's gitdir.
 */
async function rebasingBranches(repoPath: string): Promise<Set<string>> {
  const out = new Set<string>()
  const rel = (await runGit(repoPath, ['rev-parse', '--git-common-dir']).catch(() => '')).trim()
  if (!rel) return out
  const common = isAbsolute(rel) ? rel : join(repoPath, rel)
  const linked = await readdir(join(common, 'worktrees')).catch(() => [] as string[])
  const gitdirs = [common, ...linked.map((id) => join(common, 'worktrees', id))]
  for (const dir of gitdirs) {
    for (const state of ['rebase-merge', 'rebase-apply']) {
      const head = await readFile(join(dir, state, 'head-name'), 'utf8').catch(() => '')
      const ref = head.trim()
      if (ref.startsWith('refs/heads/')) out.add(ref.slice('refs/heads/'.length))
    }
  }
  return out
}

/**
 * For each branch, the first default-branch ref (remote copy first) into which
 * merging it changes nothing — its content is already there, the signature of
 * a squash merge. One `merge-tree --stdin` per ref, over the branches still
 * unmatched; a short batch (git aborts on a fatal merge) is finished one by one.
 */
async function squashMergedInto(
  repoPath: string,
  refs: string[],
  branches: { name: string; sha: string }[]
): Promise<Map<string, string>> {
  const found = new Map<string, string>()
  for (const ref of refs) {
    const pending = branches.filter((b) => !found.has(b.name))
    if (!pending.length) break
    const [baseSha, baseTree] = await Promise.all([
      runGit(repoPath, ['rev-parse', '--verify', '-q', `${ref}^{commit}`]).then((s) => s.trim(), () => ''),
      runGit(repoPath, ['rev-parse', '--verify', '-q', `${ref}^{tree}`]).then((s) => s.trim(), () => '')
    ])
    if (!baseSha || !baseTree) continue
    const stdin = pending.map((b) => `${baseSha} ${b.sha}`).join('\n') + '\n'
    const records = parseMergeTreeStdin(await gitWithStdin(repoPath, ['merge-tree', '--stdin', '--name-only'], stdin))
    for (let i = 0; i < pending.length; i++) {
      const rec = records[i] ?? (await singleMergeTree(repoPath, baseSha, pending[i].sha))
      if (rec.status === 'clean' && rec.tree === baseTree) found.set(pending[i].name, shortCleanupRef(ref))
    }
  }
  return found
}

/** The remote a plain `git pull` would use (the current branch's upstream), or 'origin'. */
async function upstreamRemote(repoPath: string): Promise<string> {
  try {
    const { stdout } = await pexecFile('git', [
      '-C',
      repoPath,
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{u}'
    ])
    const slash = stdout.trim().indexOf('/')
    if (slash > 0) return stdout.trim().slice(0, slash)
  } catch {
    /* no upstream configured → fall back to origin */
  }
  return 'origin'
}

/**
 * The git credential environment for network calls made inside `withRemoteAuth`.
 * An AsyncLocalStorage, not a parameter, so every `runGit` an operation spawns —
 * including the second push in a rename, or a fetch nested in a helper — gets it
 * without threading it through twenty call sites.
 */
const remoteAuthEnv = new AsyncLocalStorage<NodeJS.ProcessEnv>()

/**
 * The credential a repository's profile has for an https remote: its PAT, else
 * the account it linked (the GitHub CLI's, or one git's helper holds), else
 * none. The profile is the one the repository is bound to, else the active one.
 */
async function remoteCredential(repoPath: string, url: string): Promise<{ cred: BasicCredential | null; bound: boolean }> {
  const { credential, bound } = await profileCredentialForUrl(repoPath, url)
  const cred = credential
    ? (credential.cred ??
      basicAuthFor(hostFromUrl(url), credential.token, url, credential.gitUsername, credential.gitTokenKind))
    : null
  return { cred, bound: !!bound }
}

/**
 * Run a network git operation (fetch, pull, push, ls-remote) against `remote`
 * as the repository's profile. Its credential goes to git through the
 * environment (`gitCredentialEnv`): scoped to the remote's server
 * (`credentialScopeFor`), never written to `.git/config`, never in an
 * argument list. Nothing on disk changes, so a read under the shared lock can
 * use it too. With no profile credential (ssh, an unknown host, nothing
 * configured) the op runs as-is — git's own helper may
 * still answer — and `GIT_TERMINAL_PROMPT=0` makes a miss fail fast. Except for
 * a repository bound to a profile: there the remote is asked as nobody
 * (`anonymousGitEnv`), as its clone was, because the helper would sign in as
 * whichever account the machine holds while the UI names the bound profile.
 */
/**
 * Every remote's `url` and `pushurl` values as `.git/config` spells them —
 * local config only, the one file the fix may write. No remote configured
 * reads as an empty map (git config exits 1 when nothing matches).
 */
async function configuredRemoteUrls(repoPath: string): Promise<Map<string, ConfiguredRemoteUrls>> {
  const out = await runGit(repoPath, ['config', '--local', '-z', '--get-regexp', '^remote\\..+\\.(url|pushurl)$']).catch(
    () => ''
  )
  return parseRemoteUrlConfig(out)
}

async function pushUrls(repoPath: string, remote: string): Promise<string[]> {
  const { stdout } = await pexecFile('git', ['-C', repoPath, 'remote', 'get-url', '--push', '--all', '--', remote])
  return [...new Set(stdout.trimEnd().split('\n').filter(Boolean))]
}

async function withRemoteAuth<T>(repoPath: string, remote: string, direction: 'fetch' | 'push', op: () => Promise<T>): Promise<T> {
  // Every network call goes through here, so this one check covers the remote
  // argument of all of them (see assertNotOption).
  assertNotOption(remote, 'the remote')
  const { env, anonymousUrl } = await remoteOperationEnv(repoPath, remote, direction)
  if (!env) return op()
  // Older git ignores GIT_CONFIG_COUNT and would run without the credential, so
  // fail with the reason instead of "could not read Username". Going anonymous
  // works on any git.
  try {
    if (needsConfigEnv(env)) await assertGitSupportsCredentialEnv()
    if (!anonymousUrl) return await remoteAuthEnv.run(env, op)
    try {
      return await remoteAuthEnv.run(env, op)
    } catch (err) {
      throw await boundAnonymousError(repoPath, anonymousUrl, err)
    }
  } finally {
    // Every git the op ran has exited: its credential endpoints go with it.
    releaseCredentialEnv(env)
  }
}

/**
 * The environment additions a network operation on `remote` runs with (see
 * `withRemoteAuth`), and the first URL asked as nobody because the repository
 * is bound to a profile with no credential for it. Exported for the tests,
 * which put real git's credential step to it.
 */
export async function remoteOperationEnv(
  repoPath: string,
  remote: string,
  direction: 'fetch' | 'push'
): Promise<{ env?: NodeJS.ProcessEnv; anonymousUrl?: string }> {
  const urls = direction === 'push' ? await pushUrls(repoPath, remote) : [await getRemoteUrl(repoPath, remote)]
  const tokens: Array<{ url: string; cred: BasicCredential; scope: CredentialScope; context: string }> = []
  const anonymous: Array<{ url: string; scope: CredentialScope }> = []
  const seen = new Set<string>()
  for (const url of urls) {
    const { cred, bound } = await remoteCredential(repoPath, url).catch(() => ({ cred: null, bound: false }))
    if (!cred && !bound) continue
    assertCanonicalHost(url)
    // Scoped to this remote's server: two destinations of a multi-URL push on
    // one server share its entry; one on another server keeps its own.
    const scope = credentialScopeFor(url)
    const context = credentialContexts(url, scope, ['https:', 'http:'])?.context
    if (!context || seen.has(context)) continue
    seen.add(context)
    // A credential git cannot be handed (a line break in it) leaves a bound
    // repository asked as nobody, as having none does.
    if (cred && credentialUsable(url, cred, scope)) tokens.push({ url, cred, scope, context })
    else if (bound) anonymous.push({ url, scope })
  }
  // git applies every matching entry in order, and an empty helper clears the
  // ones before it. So the blank entries go first, and an outer server's token
  // before a nested one's — the outer's carve-out would clear it otherwise.
  tokens.sort((a, b) => a.context.length - b.context.length)
  const form = anonymous.length > 0 ? await anonymousConfigForm() : { configCount: false, exactUrlMatch: false }
  let env: NodeJS.ProcessEnv | undefined
  try {
    for (const a of anonymous) {
      const extra = anonymousGitEnv(a.url, { ...process.env, ...env }, a.scope, form)
      if (extra) env = { ...env, ...extra }
    }
    for (const t of tokens) {
      const extra = gitCredentialEnv(t.url, t.cred, { ...process.env, ...env }, t.scope)
      if (extra) env = { ...env, ...extra }
    }
  } catch (err) {
    // The endpoints already opened for the URLs before it would outlive the run.
    releaseCredentialEnv(env)
    throw err
  }
  return { env, anonymousUrl: anonymous[0]?.url }
}

/**
 * A bound repository asked as nobody, refused for want of a login: git says
 * "could not read Username", whose hint sends the user to git's credential
 * helper — the one thing deliberately skipped here. Name the bound profile
 * instead (`boundNoCredentialMessage`, translated by the renderer's
 * gitErrorHint). Any other failure is passed on as it is.
 */
async function boundAnonymousError(repoPath: string, url: string, err: unknown): Promise<unknown> {
  const msg = err instanceof Error ? err.message : String(err)
  if (!/could not read (?:Username|Password)|Authentication failed for/i.test(msg)) return err
  const [profile, provider] = await Promise.all([
    boundProfileName(repoPath).catch(() => undefined),
    Promise.resolve(resolveRemote(url)?.provider)
  ])
  if (!profile || !provider) return err
  let host = provider as string
  try {
    host = new URL(url).host || host
  } catch {
    /* keep the provider's name */
  }
  return new Error(boundNoCredentialMessage(provider, profile, host))
}

let gitEnvSupport: Promise<void> | null = null
/** Throws once, with a clear message, when the installed git predates config-from-environment (2.31). */
function assertGitSupportsCredentialEnv(): Promise<void> {
  gitEnvSupport ??= pexecFile('git', ['--version']).then(
    ({ stdout }) => {
      const v = gitSupportsCredentialEnv(String(stdout))
      if (!v.ok) {
        throw new Error(`${PRODUCT_NAME} needs git ${MIN_GIT_FOR_CREDENTIAL_ENV} or newer to use a profile's account for fetch and push (found ${v.found}). Update git and retry.`)
      }
    },
    () => undefined
  )
  return gitEnvSupport
}


function parseTrack(track: string): { ahead: number; behind: number } {
  const ahead = /ahead (\d+)/.exec(track)
  const behind = /behind (\d+)/.exec(track)
  return { ahead: ahead ? +ahead[1] : 0, behind: behind ? +behind[1] : 0 }
}

/**
 * Commits each side has that the other lacks, computed without checking out
 * either ref. `ahead` = commits on `local` not on `remote`; `behind` = the
 * reverse. Both > 0 means the branches have diverged and can't be
 * fast-forwarded.
 */
async function divergence(
  git: SimpleGit,
  local: string,
  remote: string
): Promise<{ ahead: number; behind: number }> {
  const out = await git.raw(['rev-list', '--left-right', '--count', `${local}...${remote}`])
  const [ahead, behind] = out.trim().split(/\s+/).map((n) => Number(n) || 0)
  return { ahead: ahead ?? 0, behind: behind ?? 0 }
}

/** Filesystem-safe timestamp (no colons) for naming backup branches. */
function backupStamp(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function mapStatusCode(code: string): FileChangeKind {
  switch (code) {
    case 'A':
      return 'A'
    case 'D':
      return 'D'
    case 'R':
      return 'R'
    case 'C':
      return 'C'
    case 'U':
      return 'U'
    case '?':
      return '?'
    default:
      return 'M'
  }
}

/** Git records a stash's reflog subject as `WIP on <branch>: …` or
 *  `On <branch>: <message>`. Split it into the originating branch and the
 *  meaningful message; the UI shows them separately so the redundant prefix
 *  isn't repeated inline. */
function parseStashSubject(subject: string): { branch: string | null; message: string } {
  const m = subject.match(/^(?:WIP on|On) ([^:]*):\s*(.*)$/)
  if (!m) return { branch: null, message: subject }
  return { branch: m[1] || null, message: (m[2] || '').trim() || subject }
}

/** MIME type by extension, covering images plus the binary formats the file
 *  previewer can render (pdf, video, audio, office docs). Unknown extensions
 *  fall back to a generic binary type so the data URL is still well-formed. */
function fileMime(file: string): string {
  const ext = (file.split('.').pop() || '').toLowerCase()
  const map: Record<string, string> = {
    // images
    svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif',
    // documents
    pdf: 'application/pdf',
    // video
    mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime', m4v: 'video/mp4',
    // audio
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac',
    // office
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }
  return map[ext] || `application/octet-stream`
}

// In-memory caps for whole-file reads. Both are overridable per call with
// `force` — the renderer surfaces the refusal and offers "load anyway", so
// nothing becomes unreachable, but a stray click on a 2GB video no longer
// allocates 5× its size across main + IPC + renderer.
const PREVIEW_MAX_BYTES = 32 * 1024 * 1024
const TEXT_MAX_BYTES = 16 * 1024 * 1024
// A tab icon is drawn at 14px and loaded for every open tab on startup; a
// megabyte is already generous for that.
const REPO_IMAGE_MAX_BYTES = 1024 * 1024

/** Byte size of a working-tree file or a blob at `ref`, null when unknowable. */
async function blobSize(repoPath: string, file: string, ref?: string): Promise<number | null> {
  try {
    if (!ref) return (await stat(join(repoPath, file))).size
    const out = await gitFor(repoPath).raw(['cat-file', '-s', `${ref}:${file}`])
    const n = Number(out.trim())
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

async function assertUnderCap(repoPath: string, file: string, ref: string | undefined, cap: number): Promise<void> {
  const size = await blobSize(repoPath, file, ref)
  if (size !== null && size > cap) throw new Error(`${FILE_TOO_LARGE_PREFIX}${size}`)
}

/** Read a file as a base64 data URL (mime by extension). Returns null if the
 *  file is missing at the given ref (e.g. an added/deleted side of a diff)
 *  instead of throwing. */
async function readFileDataUrl(repoPath: string, file: string, ref?: string): Promise<string | null> {
  try {
    let buf: Buffer
    if (!ref) {
      buf = await readFile(join(repoPath, file))
    } else {
      buf = await new Promise<Buffer>((resolve, reject) => {
        const child = spawn('git', ['-C', repoPath, 'show', `${ref}:${file}`])
        const chunks: Buffer[] = []
        const errChunks: Buffer[] = []
        child.stdout.on('data', (d: Buffer) => chunks.push(d))
        child.stderr.on('data', (d: Buffer) => errChunks.push(d))
        child.on('error', reject)
        child.on('close', (code) =>
          code === 0
            ? resolve(Buffer.concat(chunks))
            : reject(new Error(Buffer.concat(errChunks).toString() || `git show exited ${code}`))
        )
      })
    }
    return `data:${fileMime(file)};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Build a {@link BisectStatus} snapshot from the current repo state plus the
 * stdout of the bisect command that just ran (git prints progress like
 * "Bisecting: N revisions left … (roughly M steps)" and, on completion,
 * "<sha> is the first bad commit" — both to stdout).
 */
async function buildBisectStatus(repoPath: string, lastOut = ''): Promise<BisectStatus> {
  const git = gitFor(repoPath)
  const gitPath = async (name: string): Promise<string> => (await git.raw(['rev-parse', '--git-path', name])).trim()
  const absPath = (p: string): string => (p.startsWith('/') ? p : join(repoPath, p))
  const inProgress = existsSync(absPath(await gitPath('BISECT_START')))

  const empty: BisectStatus = {
    inProgress: false,
    needGood: false,
    needBad: false,
    currentSha: '',
    currentSubject: '',
    remainingSteps: -1,
    finished: false,
    firstBadSha: '',
    firstBadSubject: ''
  }
  if (!inProgress) return empty

  // Git 2.56 quotes the bisect term; older releases print it unquoted.
  const finishedMatch = lastOut.match(/([0-9a-f]{40}) is the first '?bad'? commit/)
  const stepsMatch = lastOut.match(/roughly (\d+) step/)
  const needGood = /waiting for good|waiting for both/.test(lastOut)
  const needBad = /waiting for both|bad commit/.test(lastOut) && !/bad commit known/.test(lastOut)

  let firstBadSha = ''
  let firstBadSubject = ''
  if (finishedMatch) {
    firstBadSha = finishedMatch[1]
    firstBadSubject = (await git.raw(['log', '-1', '--pretty=%s', firstBadSha]).catch(() => '')).trim()
  }

  let currentSha = ''
  let currentSubject = ''
  if (!finishedMatch && !needGood && !needBad) {
    currentSha = (await git.raw(['rev-parse', 'HEAD']).catch(() => '')).trim()
    currentSubject = (await git.raw(['log', '-1', '--pretty=%s', 'HEAD']).catch(() => '')).trim()
  }

  return {
    inProgress: true,
    needGood,
    needBad,
    currentSha,
    currentSubject,
    remainingSteps: stepsMatch ? +stepsMatch[1] : -1,
    finished: !!finishedMatch,
    firstBadSha,
    firstBadSubject
  }
}

/** Decide the base name a dropped item lands under in `dir`, honouring the
 *  caller's conflict choice. 'replace' trashes the existing entry first (so the
 *  drop is recoverable); 'keepBoth' picks the next free "name 2" style suffix. */
async function resolveDrop(repoPath: string, dir: string, name: string, mode: FsDropMode): Promise<string> {
  const dirAbs = join(repoPath, dir)
  const target = join(dirAbs, name)
  if (!existsSync(target)) return name
  if (mode === 'error') throw new Error(`Already exists: ${dir ? `${dir}/${name}` : name}`)
  if (mode === 'replace') {
    await shell.trashItem(target)
    return name
  }
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem} ${i}${ext}`
    if (!existsSync(join(dirAbs, candidate))) return candidate
  }
  throw new Error(`No free name left for ${name}`)
}

/** A ref name passed straight to git: not empty, and never read as an option. */
function isPlainRef(ref: string): boolean {
  return typeof ref === 'string' && ref.length > 0 && !ref.startsWith('-') && !/[\s\0]/.test(ref)
}

export const gitService = {
  /** A folder picked alongside others is skipped, not opened, when this is false. */
  async isRepository(repoPath: string): Promise<boolean> {
    try {
      if (!(await stat(repoPath)).isDirectory()) return false
      return await gitFor(repoPath).checkIsRepo()
    } catch {
      return false
    }
  },
  /** Check a saved tab's folder before constructing simple-git or starting reads, so a
   *  moved or unplugged repository reads as "missing" instead of a burst of git errors. */
  async directoryExists(repoPath: string): Promise<boolean> {
    try {
      return (await stat(repoPath)).isDirectory()
    } catch (err) {
      if (['ENOENT', 'ENOTDIR'].includes((err as NodeJS.ErrnoException).code ?? '')) return false
      throw err
    }
  },
  async open(repoPath: string): Promise<RepoSummary> {
    const git = gitFor(repoPath)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) throw new Error(`Not a git repository: ${repoPath}`)
    let current = 'HEAD'
    try {
      current = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim()
    } catch {
      /* empty repo */
    }
    return { path: repoPath, name: basename(repoPath), current }
  },

  /**
   * First-parent SHAs of every stash entry — the commits each stash was saved
   * on top of. Used to seed `log()` so unreachable stash bases still appear in
   * the graph and their stashes have something to connect to. Best-effort: a
   * repo with no stashes (or a failure listing them) simply yields none.
   */
  async stashBaseShas(repoPath: string): Promise<string[]> {
    try {
      const out = await runGit(repoPath, ['stash', 'list', '--pretty=format:%P'])
      const bases = new Set<string>()
      for (const line of out.split('\n')) {
        const first = line.trim().split(' ')[0]
        if (first) bases.add(first)
      }
      return [...bases]
    } catch {
      return []
    }
  },

  // `skip` pages deeper into history so "load more" fetches only the next
  // window instead of re-reading everything already loaded. Ordering is stable
  // (--date-order over the same revs), and the store dedupes by hash, so a
  // page boundary shifting under new commits cannot duplicate rows.
  async log(repoPath: string, maxCount = 400, skip = 0): Promise<GraphCommit[]> {
    // Stash base commits are frequently unreachable from any branch (a stash is
    // the only thing pointing at them). Feed those bases in as explicit revs so
    // the graph can show where each stash was taken from, instead of leaving the
    // stash floating with no parent. `--ignore-missing` keeps a stale/pruned
    // base from failing the whole log.
    const stashBases = await gitService.stashBaseShas(repoPath)
    const args = (signatures: boolean): string[] => [
      '-C',
      repoPath,
      'log',
      // Real refs only — excludes `refs/original/*` filter-branch backups and
      // other internal refs that `--all` would surface as ghost lanes.
      '--branches',
      '--tags',
      '--remotes',
      'HEAD',
      // Fork pull request heads the Commits tab fetched (fetchPrHead): private
      // refs, so the real-refs list above does not reach them.
      `--glob=${PR_HEAD_REF_PREFIX}*`,
      ...stashBases,
      '--ignore-missing',
      '--date-order',
      `--max-count=${maxCount}`,
      ...(skip > 0 ? [`--skip=${skip}`] : []),
      // Without signatures the two trailing fields stay, empty, so parsing is unchanged.
      `--pretty=format:%H${SEP}%P${SEP}%an${SEP}%ae${SEP}%at${SEP}%D${SEP}%s${SEP}%(trailers:key=Co-authored-by,valueonly,separator=%x1d)${SEP}${signatures ? `%G?${SEP}%GS` : SEP}${REC}`
    ]
    const read = async (signatures: boolean): Promise<string> =>
      (await pexecFile('git', args(signatures), { maxBuffer: 64 * 1024 * 1024 })).stdout
    // A repo already known to have a broken gpg config skips the read that fails.
    const withSignatures = !logSignaturesDisabled(repoPath)
    let raw = ''
    try {
      raw = await read(withSignatures)
      if (withSignatures) unsignedLogRepos.delete(repoPath)
    } catch (err) {
      // The `%G?`/`%GS` placeholders make git parse the gpg config, lazily, at the
      // first *signed* commit. A malformed value (an empty `gpg.format`, as some
      // GUI clients write into ~/.gitconfig) kills `git log` right there, so its
      // stdout holds only the commits above that one — a silently truncated graph.
      // `-c gpg.format=…` cannot override it (the bad file is still parsed), so
      // the only fix is to ask again without signatures: the history matters more
      // than the badges. Remembered, so every later page does not fail first.
      const salvaged = (err as { stdout?: string }).stdout ?? ''
      if (!withSignatures) raw = salvaged
      else {
        try {
          raw = await read(false)
          unsignedLogRepos.set(repoPath, Date.now())
        } catch {
          // Still failing for another reason: keep whatever the first run printed.
          raw = salvaged
        }
      }
    }
    if (!raw.trim()) return [] // empty repository
    return raw
      .split(REC)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((rec) => {
        const [hash, parents, author, email, date, refs, subject, coauthors, sigChar, signer] = rec.split(SEP)
        const signature = mapSignature(sigChar)
        return {
          hash,
          parents: parents ? parents.split(' ').filter(Boolean) : [],
          author,
          email,
          date: +date,
          refs: refs
            ? refs
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          subject: subject ?? '',
          coAuthors: parseCoAuthors(coauthors),
          signature: signature === 'none' ? undefined : signature,
          signer: signer?.trim() || undefined
        }
      })
  },

  async branches(repoPath: string): Promise<BranchesPayload> {
    // Four independent reads, so run them together rather than one after
    // another — the dispatcher's lock is already held by branches() as a whole,
    // and these are the only git processes in flight for this repo.
    const [current, headSha, localsOut, remotesOut, tagsOut] = await Promise.all([
      runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
        .then((s) => s.trim())
        .catch(() => ''),
      runGit(repoPath, ['rev-parse', 'HEAD'])
        .then((s) => s.trim())
        .catch(() => ''),
      runGit(repoPath, [
        'for-each-ref',
        `--format=%(refname:short)${SEP}%(objectname:short)${SEP}%(upstream:short)${SEP}%(upstream:track)`,
        'refs/heads'
      ]).catch(() => ''),
      runGit(
        repoPath,
        ['for-each-ref', `--format=%(refname)${SEP}%(objectname:short)${SEP}%(symref)`, 'refs/remotes'],
        undefined,
        16 * 1024 * 1024
      ).catch(() => ''),
      runGit(
        repoPath,
        ['for-each-ref', '--sort=-version:refname', `--format=%(refname:short)${SEP}%(objectname:short)`, 'refs/tags'],
        undefined,
        16 * 1024 * 1024
      ).catch(() => '')
    ])

    const mergedRefs = await mergedIntoHead(repoPath, headSha, localsOut + remotesOut)

    const locals: BranchInfo[] = []
    for (const line of localsOut.split('\n').filter(Boolean)) {
      const [name, sha, upstream, track] = line.split(SEP)
      const { ahead, behind } = parseTrack(track ?? '')
      locals.push({
        name,
        sha,
        upstream: upstream || null,
        ahead,
        behind,
        isCurrent: name === current,
        mergedIntoCurrent: mergedRefs.has(`refs/heads/${name}`)
      })
    }

    const remotes: RemoteBranchInfo[] = []
    for (const line of remotesOut.split('\n').filter(Boolean)) {
      const [refName, sha, symref] = line.split(SEP)
      if (symref || !refName.startsWith('refs/remotes/')) continue
      const fullName = refName.slice('refs/remotes/'.length)
      if (fullName.endsWith('/HEAD')) continue
      const slash = fullName.indexOf('/')
      if (slash <= 0) continue
      remotes.push({
        remote: fullName.slice(0, slash),
        name: fullName.slice(slash + 1),
        fullName,
        sha,
        mergedIntoCurrent: mergedRefs.has(refName)
      })
    }

    const tags: TagInfo[] = []
    for (const line of tagsOut.split('\n').filter(Boolean)) {
      const [name, sha] = line.split(SEP)
      tags.push({ name, sha })
    }

    return { current, locals, remotes, tags }
  },

  /**
   * Conflict Radar — merge every ref into `base` inside the object database and
   * report which ones would conflict. `git merge-tree --write-tree` writes only
   * loose objects: no index, no working tree, no refs, no checkout, so this is
   * safe to run over every branch while the user keeps working.
   */
  async mergePreview(repoPath: string, base: string, refs: string[]): Promise<MergePreviewResult> {
    const baseSha = (await runGit(repoPath, ['rev-parse', base])).trim()
    const baseTree = (await runGit(repoPath, ['rev-parse', `${base}^{tree}`])).trim()
    // Refs never contain whitespace; anything that does would corrupt the
    // one-merge-per-line stdin protocol.
    const wanted = [...new Set(refs.filter((r) => r && !/\s/.test(r)))]

    // One process for the whole batch. git aborts the stream on the first fatal
    // merge (unknown ref, unrelated histories), so short results are re-run one
    // ref at a time below rather than being reported as failures.
    let records: MergeTreeRecord[] = []
    if (wanted.length) {
      const stdin = wanted.map((r) => `${baseSha} ${r}`).join('\n') + '\n'
      const out = await gitWithStdin(repoPath, ['merge-tree', '--stdin', '--name-only'], stdin)
      records = parseMergeTreeStdin(out)
    }

    const entries: MergePreviewEntry[] = []
    for (let i = 0; i < wanted.length; i++) {
      const ref = wanted[i]
      const rec = records[i] ?? (await singleMergeTree(repoPath, baseSha, ref))
      // A merge whose result is the base tree changes nothing — the ref is
      // already contained in the base.
      const status: MergeRiskKind =
        rec.status === 'clean' && rec.tree === baseTree ? 'merged' : rec.status
      entries.push({
        ref,
        status,
        files: rec.files,
        message: rec.status === 'error' ? rec.message || 'merge-tree failed' : undefined
      })
    }

    return { base, baseSha, entries, scannedAt: Date.now() }
  },

  /**
   * Teammate radar: remote awareness computed entirely from the last fetch.
   * For every recently-moved remote branch with commits HEAD does not have,
   * report who moved it, which files those commits touch, which of them are
   * dirty in the local working tree right now, and whether merging the branch
   * into HEAD would conflict (batched in-memory merge-tree). No network.
   */
  async teammateRadar(
    repoPath: string,
    opts?: { maxBranches?: number; maxDays?: number }
  ): Promise<TeammateRadarResult> {
    const maxBranches = opts?.maxBranches ?? 30
    const maxAgeSec = (opts?.maxDays ?? 45) * 86_400
    const empty: TeammateRadarResult = { entries: [], dirtyCount: 0, scannedAt: Date.now() }

    // Unborn HEAD → nothing to compare against.
    const head = (await runGit(repoPath, ['rev-parse', '--verify', 'HEAD']).catch(() => '')).trim()
    if (!head) return empty

    // One call: every remote tip with its last committer and date, newest first.
    const raw = await runGit(repoPath, [
      'for-each-ref',
      '--sort=-committerdate',
      '--format=%(refname:short)|%(objectname:short)|%(committerdate:unix)|%(committername)',
      'refs/remotes'
    ]).catch(() => '')
    const now = Math.floor(Date.now() / 1000)
    const tips: { ref: string; sha: string; time: number; author: string }[] = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      // committername may itself contain '|' in pathological configs — keep it last and rejoin.
      const [ref, sha, time, ...rest] = line.split('|')
      // Symbolic origin/HEAD shortens to just "origin" — a real remote branch
      // short name always carries a slash.
      if (ref.endsWith('/HEAD') || !ref.includes('/')) continue
      if (now - Number(time) > maxAgeSec) continue
      tips.push({ ref, sha, time: Number(time), author: rest.join('|') })
      if (tips.length >= maxBranches) break
    }
    if (!tips.length) return empty

    const status = await gitFor(repoPath).status().catch(() => null)
    const dirty = new Set((status?.files ?? []).map((f) => f.path))

    const entries: TeammateRadarEntry[] = []
    for (const t of tips) {
      const ahead = Number(
        (await runGit(repoPath, ['rev-list', '--count', `${head}..${t.ref}`]).catch(() => '0')).trim()
      )
      if (!ahead) continue
      // Three-dot diff = what the branch would bring in, measured from the merge base.
      const files = (await runGit(repoPath, ['diff', '--name-only', `${head}...${t.ref}`]).catch(() => ''))
        .split('\n')
        .filter(Boolean)
      entries.push({
        ref: t.ref,
        sha: t.sha,
        author: t.author,
        time: t.time,
        ahead,
        filesTouched: files.length,
        overlap: files.filter((f) => dirty.has(f)),
        risk: 'clean',
        conflictFiles: []
      })
    }

    // One batched merge-tree for the conflict forecast.
    if (entries.length) {
      const preview = await gitService.mergePreview(repoPath, 'HEAD', entries.map((e) => e.ref)).catch(() => null)
      for (const p of preview?.entries ?? []) {
        const e = entries.find((x) => x.ref === p.ref)
        if (!e) continue
        e.risk = p.status
        e.conflictFiles = p.status === 'conflict' ? p.files : []
      }
    }

    // Most collision-prone first: overlap, then predicted conflicts, then recency.
    entries.sort(
      (a, b) =>
        b.overlap.length - a.overlap.length ||
        Number(b.risk === 'conflict') - Number(a.risk === 'conflict') ||
        b.time - a.time
    )
    return { entries, dirtyCount: dirty.size, scannedAt: Date.now() }
  },

  /**
   * `git range-diff` — pair up the commits of two versions of a branch and show
   * how each one was rewritten. This is the answer to "someone force-pushed,
   * what actually changed since I reviewed it?", which a plain diff cannot give
   * because every commit after a rebase looks brand new.
   *
   * With `base`, both ranges are taken from it (`base..old` vs `base..new`);
   * without it the symmetric `old...new` form lets git work the bases out —
   * which is what you want when the branch was rebased onto something else.
   */
  async rangeDiff(repoPath: string, oldRev: string, newRev: string, base?: string): Promise<RangeDiffEntry[]> {
    // Resolve first: git rejects reflog selectors inside the `old...new` form
    // ("need two commit ranges"), and `origin/feature@{1}` is exactly what the
    // reflog picker hands us.
    const [oldSha, newSha] = await Promise.all([
      runGit(repoPath, ['rev-parse', oldRev]).then((o) => o.trim()),
      runGit(repoPath, ['rev-parse', newRev]).then((o) => o.trim())
    ])
    // Without an explicit base, take the two versions' common ancestor: it
    // keeps the comparison to the commits that actually differ, and (unlike the
    // `old...new` form) still lists identical commits as unchanged when the
    // branch was rebased onto something newer.
    let effectiveBase = base?.trim()
    if (!effectiveBase) {
      effectiveBase = await runGit(repoPath, ['merge-base', oldSha, newSha])
        .then((o) => o.trim())
        .catch(() => '')
    }
    const args = effectiveBase
      ? ['range-diff', CREATION_FACTOR, effectiveBase, oldSha, newSha]
      : ['range-diff', CREATION_FACTOR, `${oldSha}...${newSha}`]
    const out = await runGit(repoPath, args)
    return parseRangeDiff(out)
  },

  /**
   * Where a ref has been, newest first, from its reflog — the free record of
   * every rebase, reset and forced fetch. Entry 0 is the current tip, so the
   * "what changed since…" picker starts at index 1.
   */
  async refTips(repoPath: string, ref: string, max = 20): Promise<RefTip[]> {
    let out = ''
    try {
      out = await runGit(repoPath, [
        'reflog',
        'show',
        `--max-count=${max}`,
        `--format=%H${SEP}%gd${SEP}%gs${SEP}%ct${SEP}%s`,
        ref
      ])
    } catch {
      return [] // no reflog for this ref (a fresh clone's remote refs, say)
    }
    const tips: RefTip[] = []
    for (const line of out.split('\n').filter(Boolean)) {
      const [sha, selector, reason, date, subject] = line.split(SEP)
      if (!sha) continue
      tips.push({ sha, selector, reason: reason ?? '', date: Number(date) || 0, subject: subject ?? '' })
    }
    // Consecutive entries pointing at the same commit (a checkout, a no-op
    // fetch) would offer the user a comparison against itself.
    return tips.filter((t, i) => i === 0 || t.sha !== tips[i - 1].sha)
  },

  /**
   * A cheap, purely local health check for one repository — the row Mission
   * Control shows for it.
   *
   * `status --porcelain=v2 --branch` answers branch, upstream, ahead/behind and
   * every dirty path in a single process, so a dashboard over twenty repos
   * costs twenty git calls rather than a hundred. Nothing here touches the
   * network: no fetch, no host API.
   */
  async repoPulse(repoPath: string): Promise<RepoPulse> {
    const pulse: RepoPulse = {
      path: repoPath,
      name: basename(repoPath),
      branch: '',
      upstream: null,
      ahead: 0,
      behind: 0,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      conflicted: 0,
      stashes: 0,
      lastCommitAt: 0,
      lastCommit: null,
      lastFetchAt: null,
      operation: null,
      activity: [],
      error: null
    }

    try {
      const out = await runGit(repoPath, ['status', '--porcelain=v2', '--branch', '-z'])
      for (const line of out.split('\0')) {
        if (!line) continue
        if (line.startsWith('# branch.head ')) {
          const head = line.slice('# branch.head '.length).trim()
          pulse.branch = head === '(detached)' ? '' : head
        } else if (line.startsWith('# branch.upstream ')) {
          pulse.upstream = line.slice('# branch.upstream '.length).trim()
        } else if (line.startsWith('# branch.ab ')) {
          const m = /\+(\d+) -(\d+)/.exec(line)
          if (m) {
            pulse.ahead = Number(m[1])
            pulse.behind = Number(m[2])
          }
        } else if (line.startsWith('u ')) {
          pulse.conflicted++
        } else if (line.startsWith('? ')) {
          pulse.untracked++
        } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
          // `<XY>` staged/worktree status pair, e.g. "1 .M N... ".
          const xy = line.slice(2, 4)
          if (xy[0] !== '.') pulse.staged++
          if (xy[1] !== '.') pulse.unstaged++
        }
      }
    } catch (err) {
      pulse.error = err instanceof Error ? err.message : String(err)
      return pulse
    }

    // The last commit's time, author and subject come back from the one `log`
    // the timestamp already needed, so the richer row costs no extra process.
    const [stashes, lastCommit, operation, lastFetchAt] = await Promise.all([
      runGit(repoPath, ['stash', 'list']).catch(() => ''),
      runGit(repoPath, ['log', '-1', '--format=%ct%x1f%an%x1f%s']).catch(() => ''),
      gitService.mergeState(repoPath).catch(() => null),
      gitService.lastFetchAt(repoPath)
    ])
    pulse.stashes = stashes.split('\n').filter(Boolean).length
    const [at, author, subject] = lastCommit.replace(/\n$/, '').split(SEP)
    pulse.lastCommitAt = Number(at) || 0
    if (pulse.lastCommitAt) pulse.lastCommit = { subject: subject ?? '', author: author ?? '' }
    pulse.lastFetchAt = lastFetchAt
    pulse.operation = operation

    // Commits per day for the last fortnight, oldest bucket first — the row's
    // sparkline. One extra cheap `log`, and only timestamps come back.
    const since = Math.floor(Date.now() / 1000) - ACTIVITY_DAYS * 86400
    const stamps = await runGit(repoPath, ['log', `--since=@${since}`, '--format=%ct']).catch(() => '')
    const buckets = new Array<number>(ACTIVITY_DAYS).fill(0)
    for (const line of stamps.split('\n')) {
      const at = Number(line)
      if (!at) continue
      const day = Math.floor((Date.now() / 1000 - at) / 86400)
      if (day >= 0 && day < ACTIVITY_DAYS) buckets[ACTIVITY_DAYS - 1 - day]++
    }
    pulse.activity = buckets
    return pulse
  },

  /**
   * The extra detail one row expands to show: what is dirty and what is waiting
   * to be pushed. Only fetched for the row the user actually opens, so a
   * dashboard of twenty repos doesn't pay for twenty of these.
   */
  async repoDetail(repoPath: string, max = 8): Promise<RepoDetail> {
    const [status, unpushed] = await Promise.all([
      gitService.status(repoPath).catch(() => null),
      // No shell involved, so the revspec goes through verbatim; a branch with
      // no upstream simply yields nothing.
      runGit(repoPath, ['log', '--format=%h%x1f%s', `--max-count=${max}`, '@{upstream}..HEAD']).catch(() => '')
    ])
    const files = [...(status?.conflicted ?? []), ...(status?.staged ?? []), ...(status?.unstaged ?? [])]
      .slice(0, max)
      .map((f) => ({ path: f.path, status: f.status }))
    const commits = unpushed
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, subject] = line.split(SEP)
        return { hash, subject: subject ?? '' }
      })
    return { files, commits }
  },

  async status(repoPath: string): Promise<RepoStatus> {
    const st = await statusScan(repoPath)
    const conflictPaths = new Set(st.conflicted)
    const staged: FileEntry[] = []
    const unstaged: FileEntry[] = []
    const conflicted: FileEntry[] = []
    for (const f of st.files) {
      if (conflictPaths.has(f.path)) {
        conflicted.push({ path: f.path, status: 'U' })
        continue
      }
      const index = f.index?.trim() ?? ''
      const work = f.working_dir?.trim() ?? ''
      if (f.index === '?' || f.working_dir === '?') {
        unstaged.push({ path: f.path, status: '?', untracked: true })
        continue
      }
      if (index && index !== '?') staged.push({ path: f.path, status: mapStatusCode(index) })
      if (work && work !== '?') unstaged.push({ path: f.path, status: mapStatusCode(work) })
    }
    return {
      current: st.current ?? '',
      tracking: st.tracking,
      ahead: st.ahead,
      behind: st.behind,
      staged,
      unstaged,
      conflicted
    }
  },

  async mergeState(repoPath: string): Promise<ConflictOpKind | null> {
    const gitDir = await absoluteGitDir(repoPath)
    const has = (name: string): boolean => existsSync(join(gitDir, name))
    if (has('rebase-merge') || has('rebase-apply')) return 'rebase'
    if (has('MERGE_HEAD')) return 'merge'
    if (has('CHERRY_PICK_HEAD')) return 'cherry-pick'
    if (has('REVERT_HEAD')) return 'revert'
    return null
  },

  // The message git prepared for an in-progress merge/cherry-pick/revert
  // (e.g. "Merge branch 'main' into feat/ui"). Empty if none is pending. Comment
  // lines (starting with '#') are stripped so it can prefill the commit composer.
  async mergeMessage(repoPath: string): Promise<string> {
    const git = gitFor(repoPath)
    const gitPath = async (name: string): Promise<string> => (await git.raw(['rev-parse', '--git-path', name])).trim()
    const abs = (p: string): string => (p.startsWith('/') ? p : join(repoPath, p))
    const msgPath = abs(await gitPath('MERGE_MSG'))
    if (!existsSync(msgPath)) return ''
    const raw = await readFile(msgPath, 'utf-8')
    return raw
      .split('\n')
      .filter((line) => !line.startsWith('#'))
      .join('\n')
      .trim()
  },

  // Who is being merged into whom. Drives the "Merging X into Y" header and the
  // "commit abc123 on branch" labels above each side of the conflict editor.
  // Returns null when no merge/rebase/cherry-pick/revert is in progress.
  async conflictContext(repoPath: string): Promise<ConflictContext | null> {
    const kind = await gitService.mergeState(repoPath)
    if (!kind) return null
    const git = gitFor(repoPath)
    const gitPath = async (name: string): Promise<string> => (await git.raw(['rev-parse', '--git-path', name])).trim()
    const abs = (p: string): string => (p.startsWith('/') ? p : join(repoPath, p))
    const readIfPresent = async (name: string): Promise<string> => {
      const p = abs(await gitPath(name))
      if (!existsSync(p)) return ''
      try {
        return (await readFile(p, 'utf-8')).trim()
      } catch {
        return ''
      }
    }

    // `main~2` / `feature^0` still identify a branch for display purposes.
    const branchOf = async (ref: string): Promise<string> => {
      try {
        const out = (await git.raw(['name-rev', '--name-only', '--refs=refs/heads/*', ref])).trim()
        if (!out || out === 'undefined') return ''
        return out.replace(/[~^].*$/, '')
      } catch {
        return ''
      }
    }
    const info = async (ref: string): Promise<ConflictRefInfo | null> => {
      try {
        const out = await git.raw(['log', '-1', `--format=%h${SEP}%s${SEP}%an${SEP}%aI`, ref])
        const [sha, subject, author, date] = out.trim().split(SEP)
        if (!sha) return null
        return { sha, subject: subject ?? '', branch: await branchOf(ref), author: author ?? '', date: date ?? '' }
      } catch {
        return null
      }
    }

    const currentBranch = async (): Promise<string> => {
      try {
        return (await git.raw(['symbolic-ref', '--quiet', '--short', 'HEAD'])).trim()
      } catch {
        return ''
      }
    }

    const theirsRef =
      kind === 'merge'
        ? 'MERGE_HEAD'
        : kind === 'cherry-pick'
          ? 'CHERRY_PICK_HEAD'
          : kind === 'revert'
            ? 'REVERT_HEAD'
            : 'REBASE_HEAD'
    const [ours, theirs] = await Promise.all([info('HEAD'), info(theirsRef)])

    let source = ''
    let target = ''
    if (kind === 'rebase') {
      // During a rebase HEAD sits on the upstream side, so `ours` is the target
      // branch and the replayed commits (`theirs`) belong to the rebased branch.
      const headName = (await readIfPresent('rebase-merge/head-name')) || (await readIfPresent('rebase-apply/head-name'))
      const onto = (await readIfPresent('rebase-merge/onto')) || (await readIfPresent('rebase-apply/onto'))
      source = headName.replace(/^refs\/heads\//, '')
      target = onto ? await branchOf(onto) : ''
      if (!target) target = ours?.branch || (onto ? onto.slice(0, 7) : '')
    } else {
      target = (await currentBranch()) || ours?.branch || ours?.sha || ''
      if (kind === 'merge') {
        // MERGE_MSG carries the ref the user actually typed ("Merge branch 'x'");
        // name-rev only knows where the sha happens to live.
        const msg = await readIfPresent('MERGE_MSG')
        const m = /^Merge (?:remote-tracking )?branch(?:es)? '([^']+)'/m.exec(msg) ?? /^Merge tag '([^']+)'/m.exec(msg)
        source = m?.[1] ?? ''
      }
      if (!source) source = theirs?.branch || theirs?.sha || ''
    }

    return { kind, source, target, ours, theirs }
  },

  async conflictVersions(repoPath: string, file: string): Promise<ConflictVersions> {
    const git = gitFor(repoPath)
    const show = async (stage: number): Promise<string | null> => {
      try {
        return await git.raw(['show', `:${stage}:${file}`])
      } catch {
        return null
      }
    }
    let content = ''
    try {
      content = await readFile(join(repoPath, file), 'utf-8')
    } catch {
      /* deleted on disk */
    }
    const [base, ours, theirs] = await Promise.all([show(1), show(2), show(3)])
    return { content, base, ours, theirs }
  },

  async resolveConflict(repoPath: string, file: string, content: string): Promise<void> {
    await writeFile(join(repoPath, file), content, 'utf-8')
    await gitFor(repoPath).add([file])
  },

  async conflictTakeSide(repoPath: string, file: string, side: ConflictSide): Promise<void> {
    const git = gitFor(repoPath)
    if (side === 'delete') {
      await git.raw(['rm', '--', file])
      return
    }
    await git.raw(['checkout', side === 'ours' ? '--ours' : '--theirs', '--', file])
    await git.add([file])
  },

  async conflictOpContinue(repoPath: string, kind: ConflictOpKind): Promise<void> {
    // Suppress the commit-message editor on --continue. Pass core.editor via a
    // `-c` arg (with allowUnsafeEditor) rather than `.env()`: simple-git's
    // unsafe-operations guard scans the *entire* env object handed to `.env()`,
    // so spreading process.env would trip on inherited vars like PAGER /
    // GIT_ASKPASS. The child still inherits the parent env naturally.
    const git = simpleGit(repoPath, { unsafe: { allowUnsafeEditor: true } })
    const noEditor = ['-c', 'core.editor=true']
    if (kind === 'merge') await git.raw([...noEditor, 'merge', '--continue'])
    else if (kind === 'cherry-pick') await git.raw([...noEditor, 'cherry-pick', '--continue'])
    else if (kind === 'rebase') await git.raw([...noEditor, 'rebase', '--continue'])
    else await git.raw([...noEditor, 'revert', '--continue'])
  },

  async conflictOpAbort(repoPath: string, kind: ConflictOpKind): Promise<void> {
    const git = gitFor(repoPath)
    if (kind === 'merge') await git.raw(['merge', '--abort'])
    else if (kind === 'cherry-pick') await git.raw(['cherry-pick', '--abort'])
    else if (kind === 'rebase') await git.raw(['rebase', '--abort'])
    else await git.raw(['revert', '--abort'])
  },

  async stashes(repoPath: string): Promise<StashInfo[]> {
    try {
      const out = await runGit(repoPath, ['stash', 'list', `--pretty=format:%H${SEP}%P${SEP}%at${SEP}%gs`])
      return out
        .split('\n')
        .filter(Boolean)
        .map((line, i) => {
          const [sha, parents, date, message] = line.split(SEP)
          const parentList = (parents ?? '').split(' ').filter(Boolean)
          const { branch, message: cleanMessage } = parseStashSubject(message ?? '')
          return {
            index: i,
            sha,
            parentSha: parentList[0] ?? '',
            untrackedSha: parentList[2] ?? null,
            date: +date,
            message: cleanMessage,
            branch
          }
        })
    } catch {
      return []
    }
  },

  async remotes(repoPath: string): Promise<RemoteInfo[]> {
    const git = gitFor(repoPath)
    const [rs, creds] = await Promise.all([
      git.getRemotes(true),
      gitService.getRemoteUrlCredentials(repoPath).catch(() => [] as RemoteUrlCredentials[])
    ])
    const byName = new Map(creds.map((c) => [c.remote, c]))
    // The renderer shows, copies and links this URL, and an old clone can hold
    // `user:token@` in it: the password never leaves main. The user name stays,
    // so editing the remote keeps it (`editRemote` leaves an unchanged URL alone).
    return rs.map((r) => {
      const c = byName.get(r.name)
      return {
        name: r.name,
        url: urlWithoutPassword(r.refs.fetch || r.refs.push),
        ...(c ? { urlCredentials: c.kind } : {}),
        ...(c?.urls.some((u) => u.ambiguous) ? { urlCredentialsAmbiguous: true as const } : {})
      }
    })
  },

  /**
   * The remotes whose configured fetch or push URLs carry a user name or a
   * password — never either value, only which URLs, what kind, and the clean
   * form. Read from `.git/config` as written: an `insteadOf` rewrite is not
   * applied, because the fix can only change what the file says.
   */
  async getRemoteUrlCredentials(repoPath: string): Promise<RemoteUrlCredentials[]> {
    return remoteUrlCredentialsFrom(await configuredRemoteUrls(repoPath))
  },

  /**
   * Take the password out of every URL of `remote` that holds one, fetch and
   * push alike, in `.git/config`. A URL with only a user name is left as it is.
   *
   * Deliberately no undo entry: undoing would write the plain-text secret back
   * into the file, and the point of this action is that it is gone. The old
   * token should be revoked on the server instead.
   */
  async removeRemoteUrlCredentials(repoPath: string, remote: string): Promise<void> {
    assertNotOption(remote, 'the remote name')
    const urls = (await configuredRemoteUrls(repoPath)).get(remote)
    if (!urls) throw new Error(`No remote named "${remote}" is configured in this repository.`)
    // Where the host starts is not certain: cutting at the wrong `@` would move
    // the remote to another server, with no undo. Left to the user to edit.
    if (hasAmbiguousPassword([...urls.fetch, ...urls.push])) {
      throw new Error(`The URL of the remote "${remote}" is ambiguous about its host. Edit the remote by hand.`)
    }
    // One `--replace-all` per address, matching only the values with a password
    // in front of it: each step rewrites in place, so a failure midway loses no
    // URL and keeps their order. Only clean values and patterns built around the
    // userinfo reach the argument list — never the old URL or the secret.
    for (const [list, variable] of [[urls.fetch, 'url'], [urls.push, 'pushurl']] as const) {
      for (const { pattern, value } of passwordRewrites(list)) {
        assertNotOption(value, 'the URL')
        await runGit(repoPath, ['config', '--local', '--replace-all', `remote.${remote}.${variable}`, value, pattern])
      }
    }
  },

  /**
   * Whether `remote` would still have a credential once the password left its
   * URL: the repository profile's token or linked account for that host, else —
   * for a repository not bound to a profile — an answer from git's own helper,
   * asked silently. Only a yes or no crosses to the renderer, for the removal's
   * confirmation to warn that fetch and push would fail.
   */
  async remoteHasProfileCredential(repoPath: string, remote: string): Promise<boolean> {
    assertNotOption(remote, 'the remote name')
    const urls = (await configuredRemoteUrls(repoPath)).get(remote)
    const first = [...(urls?.fetch ?? []), ...(urls?.push ?? [])]
      .map((u) => readUrlUserinfo(u))
      .find((r) => r.kind === 'password' && !r.ambiguous)
    // Asked with the address alone: the password in the URL must not answer for itself.
    const url = first?.clean
    if (!url || !/^https?:\/\//i.test(url)) return false
    const { cred, bound } = await remoteCredential(repoPath, url).catch(() => ({ cred: null, bound: false }))
    if (cred) return true
    if (bound) return false
    return !!(await credentialFor(url, { repoPath }).catch(() => null))
  },

  /** Per remote: which credential a push would use, whose account it is, and what it may do. */
  async remoteAuthChecks(repoPath: string): Promise<RemoteAuthCheck[]> {
    const remotes = await gitFor(repoPath).getRemotes()
    const groups = await Promise.all(remotes.map(async ({ name }) => {
      const urls = await pushUrls(repoPath, name)
      return Promise.all(urls.map((url) => checkRemoteAuth(repoPath, name, url)))
    }))
    return groups.flat()
  },

  async addRemote(repoPath: string, name: string, url: string, pushUrl?: string): Promise<void> {
    for (const [v, what] of [[name, 'the remote name'], [url, 'the URL'], [pushUrl, 'the push URL']] as const) {
      assertNotOption(v, what)
    }
    const git = gitFor(repoPath)
    await git.addRemote(name, url)
    if (pushUrl && pushUrl !== url) await git.remote(['set-url', '--push', name, pushUrl])
  },

  async removeRemote(repoPath: string, name: string): Promise<void> {
    await gitFor(repoPath).removeRemote(name)
  },

  // Rename a remote and/or update its fetch & push URLs in one shot.
  async editRemote(
    repoPath: string,
    oldName: string,
    newName: string,
    url: string,
    pushUrl?: string
  ): Promise<void> {
    for (const [v, what] of [[oldName, 'the remote name'], [newName, 'the remote name'], [url, 'the URL'], [pushUrl, 'the push URL']] as const) {
      assertNotOption(v, what)
    }
    // The dialog only ever saw the URLs without their password (`remotes`), and
    // after any `insteadOf` rewrite. Saved back as shown, a URL means "keep it":
    // it is not written at all — `git remote rename` carries the URLs over — so
    // neither the configured secret nor one an `insteadOf` rule adds is copied
    // into .git/config or an argument list. A URL the user did edit is written
    // as typed: changing the host or path drops a saved password with it.
    // Taking a password out alone is `removeRemoteUrlCredentials`.
    const configured = (await configuredRemoteUrls(repoPath)).get(oldName) ?? { fetch: [], push: [] }
    const [effectiveUrl, effectivePush] = await Promise.all([
      getRemoteUrl(repoPath, oldName),
      pushUrls(repoPath, oldName).catch(() => [] as string[])
    ])
    const shownAs = (value: string, candidates: string[]): boolean =>
      candidates.some((c) => c === value || urlWithoutPassword(c) === value)
    const fetchChanged = !!url && !shownAs(url, [...configured.fetch.slice(0, 1), effectiveUrl].filter(Boolean))
    const pushChanged = !!pushUrl && !shownAs(pushUrl, [...configured.push, ...effectivePush])
    if (newName && newName !== oldName) await runGit(repoPath, ['remote', 'rename', oldName, newName])
    const name = newName || oldName
    if (fetchChanged) {
      await runGit(repoPath, ['remote', 'set-url', name, url])
      // A push URL that only mirrored the old fetch URL follows it.
      const mirror = configured.push.length === 1 && configured.push[0] === configured.fetch[0]
      if (mirror && !pushChanged) await runGit(repoPath, ['remote', 'set-url', '--push', name, url])
    }
    // An empty push URL means the dialog's field was left alone: a distinct push
    // URL already configured stays as it is.
    if (pushChanged && pushUrl) {
      if (pushUrl === (fetchChanged ? url : effectiveUrl) && !configured.push.length) return
      await runGit(repoPath, ['remote', 'set-url', '--push', name, pushUrl])
    }
  },

  async fetchRemote(repoPath: string, name: string): Promise<void> {
    await withRemoteAuth(repoPath, name, 'fetch', () => runGit(repoPath, ['fetch', '--prune', '--', name]))
  },

  /**
   * Fetch one branch of `remote` into its remote-tracking ref, so a branch
   * that exists only on the server (a pull request's head, in a repository
   * with thousands of branches nobody fetches in full) can be checked out.
   *
   * The name comes from a hosting API, not from the user, so it is validated
   * before it is spliced into a refspec: a `:` or a leading `+` would rewrite
   * which ref gets written, and a leading `-` would be read as an option.
   * `--no-tags` for the same reason as `previewRef`.
   *
   * Returns false when the remote has no such branch — the usual fate of a
   * merged pull request's head. Any other failure throws.
   */
  async fetchRemoteBranch(repoPath: string, remote: string, branch: string): Promise<boolean> {
    await assertSafeRemoteBranch(repoPath, remote, branch)
    const refspec = `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`
    try {
      await withRemoteAuth(repoPath, remote, 'fetch', () =>
        runGit(repoPath, ['fetch', '--no-tags', '--', remote, refspec])
      )
      return true
    } catch (err) {
      if (/couldn't find remote ref/i.test(err instanceof Error ? err.message : String(err))) return false
      throw err
    }
  },

  // ─── Previewing someone else's work ────────────────────────────────────────

  /**
   * Find the ref a pull request's head lives under on `remote`.
   *
   * Every candidate convention goes into one `ls-remote`, so an unknown or
   * self-hosted forge costs the same single round trip as GitHub. No API token
   * and no fork remote are involved — which is the whole point: a PR from a
   * fork is previewable even when its source repository is unreachable.
   *
   * Returns null when the remote publishes no such ref (the host does not
   * mirror PR heads, or the number does not exist).
   *
   * Not a READ_METHOD, for a reason that is gone: `withRemoteAuth` used to
   * rewrite `.git/config` to inject the PAT, and two of these under the shared
   * lock raced for `.git/config.lock`. It now writes nothing, so this could move
   * to READ_METHODS; the exclusive lock it keeps is merely conservative.
   */
  async resolvePrRef(repoPath: string, remote: string, number: number): Promise<PrRefProbe | null> {
    return probePrRef(repoPath, remote, prRefCandidates(number, await getRemoteUrl(repoPath, remote)))
  },

  /**
   * Fetch a pull request's head into `refs/githuttbr/pr/<remote>/<number>`, so
   * its commits are in this clone even when its branch lives in a fork no
   * remote here points at. The head is found the way `resolvePrRef` finds it —
   * the target repository mirrors it under a well-known ref (`refs/pull/N/head`,
   * `refs/merge-requests/N/head`, `refs/pull-requests/N/from`). Azure DevOps
   * publishes only a synthetic merge commit, which is no head: not fetched.
   *
   * A private ref, like `refs/githuttbr/wip`: not a remote-tracking branch, so
   * it never takes the place of a real `pr/N` branch, `fetch --prune` leaves it
   * alone (the commits stay safe from gc), and it is nothing to check out or
   * push. The graph walks it explicitly (`log`). It stays until deleted by hand.
   *
   * The number and the remote are checked before either reaches a refspec, as
   * `fetchRemoteBranch` checks its branch; `--no-tags` as there. A write, not a
   * READ_METHOD: it moves a ref.
   *
   * Returns the ref written, or null when the remote publishes no head for
   * that number.
   */
  async fetchPrHead(repoPath: string, remote: string, number: number): Promise<string | null> {
    if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`Refusing the pull request number "${number}".`)
    await assertConfiguredRemote(repoPath, remote)
    // One plain path segment: a remote named `a/b` would nest under another's numbers.
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(remote) || remote.endsWith('.lock') || remote.includes('..')) {
      throw new Error(`Refusing the remote "${remote}" in a ref name.`)
    }
    const local = `${PR_HEAD_REF_PREFIX}${remote}/${number}`
    const normalized = await runGit(repoPath, ['check-ref-format', '--normalize', local]).catch(() => '')
    if (normalized.trim() !== local) throw new Error(`Refusing the ref "${local}": git does not accept it.`)
    const candidates = prRefCandidates(number, await getRemoteUrl(repoPath, remote)).filter((c) => c.flavor !== 'azure')
    const hit = await probePrRef(repoPath, remote, candidates)
    if (!hit) return null
    await withRemoteAuth(repoPath, remote, 'fetch', () =>
      runGit(repoPath, ['fetch', '--no-tags', '--', remote, `+${hit.ref}:${local}`])
    )
    return local
  },

  /**
   * Bring `ref` down from `remote` and apply it locally without writing a
   * commit, so the work can be run and then dropped without a trace:
   *
   * - `checkout` fetches it onto `localBranch` (reset with `-B`, so previewing
   *   the same PR twice reuses the branch) and switches to it.
   * - `merge` merges it into the current branch with `--no-commit --no-ff`,
   *   leaving the merged tree staged. Conflicts are reported rather than
   *   thrown, because a conflicted preview is a useful answer.
   *
   * The fetch is deliberately `--no-tags`: a preview should not drag the
   * remote's tag namespace into the local repository.
   */
  async previewRef(
    repoPath: string,
    remote: string,
    ref: string,
    mode: PrPreviewMode,
    localBranch?: string
  ): Promise<PrPreviewResult> {
    await withRemoteAuth(repoPath, remote, 'fetch', () => runGit(repoPath, ['fetch', '--no-tags', '--', remote, ref]))
    const sha = (await runGit(repoPath, ['rev-parse', 'FETCH_HEAD'])).trim()

    if (mode === 'checkout') {
      if (!localBranch) throw new Error('A local branch name is required to check out a preview')
      await runGit(repoPath, ['checkout', '-B', localBranch, sha])
      return { ref, sha, mode, localBranch, conflicts: [] }
    }

    // Run the merge through `runGit`, not simple-git: simple-git's `raw`
    // *resolves* on a conflicted merge, which would report a clean preview over
    // a conflicted tree. A non-zero exit here is expected — the conflicted tree
    // it leaves behind is exactly what the user asked to see, so read the
    // conflicts back instead of surfacing git's error.
    try {
      await runGit(repoPath, ['merge', '--no-commit', '--no-ff', sha])
    } catch (err) {
      const conflicts = (await runGit(repoPath, ['diff', '--name-only', '--diff-filter=U']))
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      if (conflicts.length === 0) throw err
      return { ref, sha, mode, conflicts }
    }
    return { ref, sha, mode, conflicts: [] }
  },

  // ─── Branch / nav operations ───────────────────────────────────────────────

  async checkout(repoPath: string, ref: string): Promise<void> {
    await gitFor(repoPath).checkout(ref)
  },

  async checkoutRemote(
    repoPath: string,
    fullName: string,
    localName: string,
    remote?: string
  ): Promise<CheckoutRemoteResult> {
    const git = gitFor(repoPath)
    if (remote) {
      // Refresh the remote-tracking ref first, so "checkout as local" always
      // picks up the actual remote tip instead of whatever was last fetched.
      // runGit, so the profile's credential from withRemoteAuth reaches it.
      // checkoutRemote is a write method: the dispatcher holds this repo's
      // exclusive lock, so nothing else runs alongside to collide on
      // `.git/index.lock`. Best-effort: offline/auth hiccups shouldn't block
      // checking out the locally-known ref.
      await withRemoteAuth(repoPath, remote, 'fetch', () => runGit(repoPath, ['fetch', '--', remote, localName])).catch(() => {})
    }
    // If a local branch with that name already exists, just switch to it
    // instead of trying to recreate a tracking branch (which would fail with
    // "a branch named '<x>' already exists").
    const branches = await git.branchLocal()
    if (branches.all.includes(localName)) {
      // Compare the existing local branch with the remote tip before touching
      // anything. If they've diverged (both have unique commits) a fast-forward
      // is impossible — report it so the renderer can ask the user how to
      // reconcile instead of dumping git's raw "Not possible to fast-forward".
      const { ahead, behind } = await divergence(git, localName, fullName)
      if (ahead > 0 && behind > 0) {
        return { diverged: true, aheadOnly: false, ahead, behind }
      }
      // The local branch is ahead and the remote has nothing new. Silently
      // checking it out answers a request for the remote branch with local
      // work — so report it and let the renderer ask what the user meant.
      if (ahead > 0) {
        return { diverged: false, aheadOnly: true, ahead, behind }
      }
      // Fast-forward the existing local branch to the remote tip so the
      // checkout actually brings in the remote changes. withAutoStash shelves a
      // dirty working tree under a named stash before the FF and restores it
      // after, so local edits don't abort the update.
      await withAutoStash(repoPath, `checkout ${localName}`, async () => {
        await git.checkout(localName)
        if (behind > 0) await git.merge(['--ff-only', fullName])
      })
      return { diverged: false, aheadOnly: false, ahead, behind }
    } else {
      await git.checkout(['-b', localName, '--track', fullName])
      const createdAt = (await runGit(repoPath, ['rev-parse', 'HEAD'])).trim()
      return { diverged: false, aheadOnly: false, ahead: 0, behind: 0, createdAt }
    }
  },

  /**
   * Reconcile a diverged local branch with its remote after the user picks a
   * strategy in the divergence dialog. When `backup` is set, a
   * `backup/<localName>-<timestamp>` branch is created at the current local tip
   * first, so even a `reset` can be undone by checking that branch out.
   *   - rebase:       replay local commits on top of the remote tip (linear history)
   *   - merge:        --no-ff merge, keeping both histories
   *   - reset-soft:   move the branch to the remote tip, keep the commits' changes staged
   *   - reset-mixed:  same, but leave the changes unstaged in the working tree
   *   - reset-hard:   discard the local commits and their changes entirely
   */
  async resolveDivergedCheckout(
    repoPath: string,
    fullName: string,
    localName: string,
    strategy: DivergedStrategy,
    backup: boolean
  ): Promise<{ backupRef?: string; previousRef: string }> {
    const git = gitFor(repoPath)
    let backupRef: string | undefined
    // The tip we are about to move away from — the renderer keeps it as the
    // undo target, so a reset is recoverable even without a backup branch.
    const previousRef = (await git.revparse([localName])).trim()
    await withAutoStash(repoPath, `checkout ${localName}`, async () => {
      await git.checkout(localName)
      if (backup) {
        backupRef = `backup/${localName}-${backupStamp()}`
        await git.branch([backupRef])
      }
      if (strategy === 'rebase') await git.rebase([fullName])
      else if (strategy === 'merge') await git.merge(['--no-ff', fullName])
      // reset-soft / reset-mixed / reset-hard map straight onto git's modes:
      // how much of the discarded commits survives in the index and the tree.
      else await git.reset([`--${strategy.slice('reset-'.length)}`, fullName])
    })
    return { backupRef, previousRef }
  },

  async createBranch(repoPath: string, name: string, at?: string, checkout = true): Promise<void> {
    const git = gitFor(repoPath)
    if (checkout) await git.checkout(at ? ['-b', name, at] : ['-b', name])
    else await git.branch(at ? [name, at] : [name])
  },

  async deleteBranch(repoPath: string, name: string, force = false): Promise<void> {
    await gitFor(repoPath).branch([force ? '-D' : '-d', name])
  },

  /**
   * Delete a branch only while it still points at `sha` — the undo of a
   * checkout that created it. A commit made on it since is the user's work, so
   * a moved branch is left in place (false) instead of force-deleted. Not an
   * error: the undo it belongs to has still done its part, the checkout back.
   */
  async deleteBranchIfAt(repoPath: string, name: string, sha: string): Promise<boolean> {
    assertNotOption(name, 'the branch name')
    const tip = (await runGit(repoPath, ['rev-parse', '--verify', '-q', `refs/heads/${name}^{commit}`]).catch(() => '')).trim()
    if (!tip || tip !== sha) return false
    await runGit(repoPath, ['branch', '-D', '--', name])
    return true
  },

  // ─── Branch cleanup ────────────────────────────────────────────────────
  // Local branches whose work already lives somewhere else: the upstream was
  // deleted on the server (a merged PR), or the default branch contains them.
  // Built for repositories with thousands of branches, so the cost is a fixed
  // handful of git calls, never one per branch.

  /**
   * Every local branch the cleanup may offer, with what it knows about each.
   * Classification (which reasons apply, what is pre-selected) is the
   * renderer's, in lib/branchCleanup — this only reports facts.
   */
  async getBranchCleanupCandidates(repoPath: string): Promise<BranchCleanupScan> {
    const fmt = [
      '%(refname:lstrip=2)',
      '%(objectname)',
      '%(HEAD)',
      '%(upstream:lstrip=2)',
      '%(upstream:track)',
      '%(committerdate:unix)'
    ].join('%00')
    const big = 64 * 1024 * 1024
    const [refsOut, remoteRefsOut, remotesOut, worktrees, rebasing, localProtected, config, lastFetchAt] =
      await Promise.all([
        runGit(repoPath, ['for-each-ref', `--format=${fmt}`, 'refs/heads'], undefined, big),
        runGit(repoPath, ['for-each-ref', '--format=%(refname)', 'refs/remotes'], undefined, big).catch(() => ''),
        runGit(repoPath, ['remote']).catch(() => ''),
        gitService.worktrees(repoPath),
        rebasingBranches(repoPath),
        gitService.protectedBranches(repoPath).catch(() => ['main', 'master']),
        readRepoConfig(repoPath).catch(() => null),
        gitService.lastFetchAt(repoPath)
      ])
    const rows = refsOut
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [name, sha, head, upstream, track, date] = line.split('\0')
        return { name, sha, isCurrent: head === '*', upstream: upstream || null, track: track ?? '', date: +date * 1000 }
      })
    const localNames = new Set(rows.map((r) => r.name))
    const remoteRefs = new Set(remoteRefsOut.split('\n').filter(Boolean))
    const remotes = remotesOut.split('\n').map((s) => s.trim()).filter(Boolean)
    const main = await cleanupMainRefs(repoPath, localNames, remoteRefs, remotes)

    // Merged into either copy of the default branch, one for-each-ref each.
    // The unique-commit walk is one rev-list: every local branch, minus every
    // remote-tracking ref and the local default branch.
    const notMain = main.mainBranch && localNames.has(main.mainBranch) ? [`refs/heads/${main.mainBranch}`] : []
    const [mergedOuts, uniqueOut, mainTips] = await Promise.all([
      Promise.all(
        main.refs.map((ref) =>
          runGit(repoPath, ['for-each-ref', '--format=%(refname:lstrip=2)', `--merged=${ref}`, 'refs/heads'], undefined, big)
        )
      ),
      runGit(repoPath, ['rev-list', '--parents', '--branches', '--not', '--remotes', ...notMain, '--'], undefined, 256 * 1024 * 1024),
      Promise.all(main.refs.map((ref) => runGit(repoPath, ['rev-parse', '--verify', '-q', ref]).then((s) => s.trim(), () => '')))
    ])
    // The first ref that contains a branch names it: the remote copy wins, so
    // "main" alone means a merge that only exists here.
    const mergedInto = new Map<string, string>()
    mergedOuts.forEach((out, i) => {
      const short = shortCleanupRef(main.refs[i])
      for (const name of out.split('\n').filter(Boolean)) if (!mergedInto.has(name)) mergedInto.set(name, short)
    })
    const unique = parseRevListParents(uniqueOut)
    const tips = new Set(mainTips.filter(Boolean))

    const inWorktree = new Set(worktrees.filter((w) => w.branch && !w.isCurrent).map((w) => w.branch as string))
    const protectedPatterns = [...new Set([...localProtected, ...(config?.config?.protect ?? [])])]
    const exclusionOf = (name: string, isCurrent: boolean): BranchCleanupExclusion | null => {
      if (isCurrent) return 'current'
      if (inWorktree.has(name)) return 'worktree'
      // Mid-rebase, HEAD is detached and the branch looks free — deleting it
      // would leave the rebase nowhere to land.
      if (rebasing.has(name)) return 'rebasing'
      if (name === main.mainBranch) return 'default'
      if (protectedPatterns.some((p) => branchMatches(p, name))) return 'protected'
      return null
    }

    const candidates: BranchCleanupCandidate[] = []
    const excluded: BranchCleanupScan['excluded'] = []
    for (const r of rows) {
      const reason = exclusionOf(r.name, r.isCurrent)
      if (reason) {
        excluded.push({ name: r.name, reason })
        continue
      }
      const { count, capped } = countUniqueCommits(unique, r.sha)
      candidates.push({
        name: r.name,
        sha: r.sha,
        upstream: r.upstream,
        gone: parseUpstreamTrack(r.track).gone,
        merged: mergedInto.has(r.name),
        mergedInto: mergedInto.get(r.name) ?? null,
        atMainTip: tips.has(r.sha),
        lastCommitAt: r.date,
        uniqueCommits: count,
        uniqueCapped: capped
      })
    }
    return { mainBranch: main.mainBranch, mainRef: main.mainRef, mainRefs: main.refs, candidates, excluded, lastFetchAt }
  },

  /**
   * Which of `names` were squash-merged: merging the branch into the default
   * branch changes nothing, so its content is already there even though its
   * commits are not. One batched `merge-tree` per copy of the default branch —
   * no index, no working tree, only loose tree objects, as the conflict radar.
   * Opt-in from the dialog: it costs a few milliseconds per branch.
   */
  async getSquashMergedBranches(repoPath: string, names: string[]): Promise<BranchSquashCheck[]> {
    const wanted = [...new Set(names)]
    if (!wanted.length) return []
    const scan = await gitService.getBranchCleanupCandidates(repoPath)
    const byName = new Map(scan.candidates.map((c) => [c.name, c]))
    const branches = wanted.flatMap((n) => {
      const c = byName.get(n)
      return c ? [{ name: n, sha: c.sha }] : []
    })
    const into = await squashMergedInto(repoPath, scan.mainRefs, branches)
    return wanted.map((name) => ({ name, squashedInto: into.get(name) ?? null }))
  },

  /**
   * Delete the branches the cleanup dialog chose, and report each one.
   *
   * Nothing from the renderer is taken on trust: the scan runs again under the
   * write lock, and a branch is refused when it no longer exists, moved since
   * the dialog listed it, became current, sits in a worktree or a rebase, is
   * the default or protected — or holds more commits found nowhere else than
   * the user accepted losing. A branch accepted as squash-merged has its
   * merge-tree check run again here, and is refused if it no longer holds.
   *
   * The deletion itself is `git branch -D`, after that check. `-d` would test
   * "merged" against HEAD or the upstream, and a branch whose upstream is gone
   * has only HEAD left — so `-d` would refuse every merged branch while you
   * stand on anything but main, and say nothing about the remotes. The check
   * above is the one this feature promises.
   */
  async deleteLocalBranches(repoPath: string, requests: BranchDeleteRequest[]): Promise<BranchDeleteResult[]> {
    if (!requests.length) return []
    const scan = await gitService.getBranchCleanupCandidates(repoPath)
    const byName = new Map(scan.candidates.map((c) => [c.name, c]))
    const excludedBy = new Map(scan.excluded.map((e) => [e.name, e.reason]))
    const tracking = parseBranchTrackingConfig(
      await runGit(repoPath, ['config', '--get-regexp', '^branch\\..*\\.(remote|merge)$']).catch(() => '')
    )
    // Squash acceptances are only honoured for branches that still need them.
    const squashWanted = requests.filter((r) => {
      const c = byName.get(r.name)
      return r.squashMerged && c && c.sha === r.sha && c.uniqueCommits > Math.max(0, r.acceptedUnique)
    })
    const squashed = squashWanted.length
      ? await squashMergedInto(
          repoPath,
          scan.mainRefs,
          squashWanted.map((r) => ({ name: r.name, sha: r.sha }))
        )
      : new Map<string, string>()

    const results: BranchDeleteResult[] = []
    const allowed: BranchDeleteResult[] = []
    const seen = new Set<string>()
    for (const req of requests) {
      if (seen.has(req.name)) continue
      seen.add(req.name)
      const refuse = (refusal: BranchDeleteResult['refusal']): void => {
        results.push({ name: req.name, sha: req.sha, status: 'refused', refusal })
      }
      const excludedReason = excludedBy.get(req.name)
      const found = byName.get(req.name)
      const accepted = Number.isFinite(req.acceptedUnique) ? Math.max(0, req.acceptedUnique) : 0
      if (excludedReason) refuse(excludedReason)
      else if (!found) refuse('missing')
      else if (found.sha !== req.sha) refuse('moved')
      else if (found.uniqueCommits > accepted && req.squashMerged && !squashed.has(req.name)) refuse('squashChanged')
      else if (found.uniqueCommits > accepted && !req.squashMerged) refuse('unique')
      else {
        const t = tracking.get(req.name)
        const entry: BranchDeleteResult = { name: req.name, sha: found.sha, status: 'deleted' }
        if (t?.remote) entry.upstreamRemote = t.remote
        if (t?.merge) entry.upstreamMerge = t.merge
        allowed.push(entry)
        results.push(entry)
      }
    }

    // In batches: one spawn per hundred branches, not one per branch. git
    // carries on past a branch it cannot delete, so a failed batch is read
    // back from the refs rather than trusted from the exit code.
    const failures: string[] = []
    for (let i = 0; i < allowed.length; i += 100) {
      const names = allowed.slice(i, i + 100).map((e) => e.name)
      await runGit(repoPath, ['branch', '-D', '--', ...names]).catch((err: unknown) => {
        failures.push(err instanceof Error ? err.message : String(err))
      })
    }
    if (failures.length) {
      const left = new Set(
        (await runGit(repoPath, ['for-each-ref', '--format=%(refname:lstrip=2)', 'refs/heads'])).split('\n').filter(Boolean)
      )
      for (const e of allowed) {
        if (!left.has(e.name)) continue
        e.status = 'failed'
        e.error = failures.join('\n')
        delete e.upstreamRemote
        delete e.upstreamMerge
      }
    }
    return results
  },

  /**
   * The undo of a cleanup: recreate each branch at its exact sha and put its
   * tracking config back. A name that is back at the same commit needs
   * nothing. A name taken since by another commit — a PR checked out again —
   * is not ours to move: the deleted branch comes back beside it, as
   * `<name>-restored-<short sha>`, and the result says so.
   */
  async restoreLocalBranches(repoPath: string, requests: BranchRestoreRequest[]): Promise<BranchRestoreResult[]> {
    const existing = new Map(
      (await runGit(repoPath, ['for-each-ref', '--format=%(refname:lstrip=2)%00%(objectname)', 'refs/heads']))
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('\0') as [string, string])
    )
    const results: BranchRestoreResult[] = []
    for (const req of requests) {
      try {
        assertNotOption(req.name, 'the branch name')
        if (!isObjectId(req.sha)) throw new Error(`Refusing "${req.sha}": it is not a commit id.`)
        let name = req.name
        if (existing.get(name) === req.sha) {
          results.push({ name: req.name, status: 'exists' })
          continue
        }
        if (existing.has(name)) {
          name = `${req.name}-restored-${req.sha.slice(0, 7)}`
          if (existing.get(name) === req.sha) {
            results.push({ name: req.name, status: 'restoredAs', restoredAs: name })
            continue
          }
          if (existing.has(name)) throw new Error(`"${req.name}" and "${name}" both exist at other commits.`)
        }
        await runGit(repoPath, ['branch', '--no-track', '--', name, req.sha])
        if (req.upstreamRemote) await runGit(repoPath, ['config', '--', `branch.${name}.remote`, req.upstreamRemote])
        if (req.upstreamMerge) await runGit(repoPath, ['config', '--', `branch.${name}.merge`, req.upstreamMerge])
        existing.set(name, req.sha)
        results.push(
          name === req.name ? { name: req.name, status: 'restored' } : { name: req.name, status: 'restoredAs', restoredAs: name }
        )
      } catch (err) {
        results.push({ name: req.name, status: 'failed', error: err instanceof Error ? err.message : String(err) })
      }
    }
    return results
  },

  async deleteRemoteBranch(repoPath: string, remote: string, name: string): Promise<void> {
    try {
      await withRemoteAuth(repoPath, remote, 'push', () => runGit(repoPath, ['push', '--delete', '--', remote, name]))
    } catch (err) {
      // The branch may already be gone on the remote (e.g. Dependabot deleted it
      // after merging its PR) while our local remote-tracking ref lingers because
      // no pruning fetch has run. Git reports this as "remote ref does not exist".
      // In that case there is nothing to push — just prune the stale tracking ref
      // so it disappears from the branch list, which is what the user expects.
      const msg = err instanceof Error ? err.message : String(err)
      if (!/remote ref does not exist/i.test(msg)) throw err
    }
    // Whether the push succeeded or the ref was already gone, drop the local
    // remote-tracking copy so the UI no longer shows the deleted branch.
    await runGit(repoPath, ['update-ref', '-d', `refs/remotes/${remote}/${name}`]).catch(() => undefined)
  },

  // ─── Stacked branches ──────────────────────────────────────────────────
  // A "stack" is a chain of dependent branches where each is based on the one
  // below it. We persist the parent (and the parent tip we last rebased onto)
  // in git config under branch.<name>.githuttbrparent / .githuttbrbase (see
  // readStackMeta for the legacy keys), so the metadata travels with the repo
  // and never touches history.

  /** Record (or change) a branch's stack parent, snapshotting the parent tip. */
  async stackSetParent(repoPath: string, branch: string, parent: string): Promise<void> {
    const git = gitFor(repoPath)
    const tip = (await git.revparse([parent])).trim()
    await writeStackMeta(git, branch, 'parent', parent)
    await writeStackMeta(git, branch, 'base', tip)
  },

  /** Stop tracking a branch as part of a stack. */
  async stackClearParent(repoPath: string, branch: string): Promise<void> {
    const git = gitFor(repoPath)
    await clearStackMeta(git, branch, 'parent')
    await clearStackMeta(git, branch, 'base')
  },

  /**
   * The stack containing `leaf` (defaults to the current branch): walk parent
   * links down to the trunk, then report each level bottom→top with its own
   * commit count and whether its parent has moved (needs a restack).
   */
  async stackInfo(repoPath: string, leaf?: string): Promise<StackInfo> {
    const git = gitFor(repoPath)
    const current = (await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => '')).trim()
    const head = leaf || current
    if (!head || head === 'HEAD') return { trunk: '', branches: [] }

    // Read all recorded parents in one shot.
    const parents: Record<string, string> = Object.fromEntries(await readStackParents(git))

    // Walk down to the trunk, guarding against cycles.
    const chainTopDown: string[] = []
    const seen = new Set<string>()
    let cur: string | null = head
    while (cur && parents[cur] && !seen.has(cur)) {
      seen.add(cur)
      chainTopDown.push(cur)
      cur = parents[cur]
    }
    // A branch with no recorded parent is not on a stack. Saying so is the
    // honest answer: the alternative — a one-level stack whose trunk is the
    // branch itself — reads in the UI as "main lands on main", which is not a
    // thing, and invites edits to a route that does not exist.
    if (chainTopDown.length === 0) return { trunk: '', branches: [] }
    const trunk = parents[chainTopDown[chainTopDown.length - 1]] ?? cur ?? ''
    const ordered = chainTopDown.slice().reverse() // bottom → top

    const branches: StackBranch[] = []
    for (const name of ordered) {
      const parent = parents[name] ?? null
      let ahead = 0
      let needsRestack = false
      if (parent) {
        ahead = Number(
          (await git.raw(['rev-list', '--count', `${parent}..${name}`]).catch(() => '0')).trim()
        )
        const parentTip = (await git.revparse([parent]).catch(() => '')).trim()
        // Restack needed when the parent tip is not yet an ancestor of branch.
        // (merge-base --is-ancestor signals via exit code, which simple-git does
        // not reliably reject on — compare the merge-base sha instead.)
        if (parentTip) {
          const base = (await git.raw(['merge-base', parentTip, name]).catch(() => '')).trim()
          needsRestack = base !== parentTip
        }
      }
      branches.push({ name, parent, isCurrent: name === current, ahead, needsRestack })
    }
    return { trunk, branches }
  },

  /**
   * Re-link a whole stack to `order` (bottom → top, sitting on `trunk`) and
   * replay it.
   *
   * Reordering is not "set some config": each level's commits have to move onto
   * a different base, which is a rebase per level. What makes that survivable is
   * the boundary snapshot below — a level's own commits are the ones after its
   * recorded base, and once the parent links are rewritten the old merge-base is
   * gone. So the boundary is written first, for every level that lacks one, and
   * only then do the links change.
   *
   * Throws on the first conflicting rebase, leaving git in its usual
   * mid-rebase state for the conflict UI to pick up.
   */
  async stackReorder(repoPath: string, trunk: string, order: string[]): Promise<void> {
    const git = gitFor(repoPath)
    if (order.length === 0) return
    // Every stop in the route gets rebased. The branch the stack lands on is
    // not a stop, and neither is a protected branch — either one here would
    // quietly rewrite the history everyone else is working from.
    if (order.includes(trunk)) throw new Error(`"${trunk}" is where the stack lands — it cannot also be a stop on it.`)
    if (new Set(order).size !== order.length) throw new Error('A branch cannot be on the same stack twice.')
    const protectedNames = await gitService.protectedBranches(repoPath).catch(() => [] as string[])
    const guarded = order.filter((b) => protectedNames.includes(b))
    if (guarded.length) {
      throw new Error(
        `Refusing to rebase protected ${guarded.length === 1 ? 'branch' : 'branches'}: ${guarded.join(', ')}.`
      )
    }
    // Atomic: a reorder is a picker gesture, and one that half-lands and drops
    // the user into a mid-rebase is worse than one that refuses. The snapshot
    // below is what makes "nothing happened" true after a conflict.
    await withStackRollback(repoPath, [...order, trunk], async () => {
      for (const branch of order) {
        const existing = await readStackMeta(git, branch, 'base')
        if (existing) continue
        const oldParent = (await readStackMeta(git, branch, 'parent')) || trunk
        const base = (await git.raw(['merge-base', oldParent, branch]).catch(() => '')).trim()
        if (base) await writeStackMeta(git, branch, 'base', base)
      }
      for (let i = 0; i < order.length; i++) {
        await writeStackMeta(git, order[i], 'parent', i === 0 ? trunk : order[i - 1])
      }
      await gitService.stackRestack(repoPath, order[order.length - 1])
    })
  },

  /**
   * Which of `branches` the remote actually carries, in one `ls-remote`.
   *
   * A push that "succeeded" into the wrong remote, or a branch nobody pushed,
   * both end as the same GitHub 422 — a validation failure whose entry carries
   * no message. Asking the remote first turns that into a sentence naming the
   * branch.
   */
  async remoteHasBranches(repoPath: string, remote: string, branches: string[]): Promise<string[]> {
    if (!branches.length) return []
    const out = await withRemoteAuth(repoPath, remote, 'fetch', () =>
      runGit(repoPath, ['ls-remote', '--heads', '--', remote, ...branches.map((b) => `refs/heads/${b}`)])
    ).catch(() => '')
    const present = new Set<string>()
    for (const line of out.split('\n')) {
      const ref = line.split('\t')[1]?.trim()
      if (ref?.startsWith('refs/heads/')) present.add(ref.slice('refs/heads/'.length))
    }
    return branches.filter((b) => present.has(b))
  },

  /**
   * The leaf of every stack in the repository: a branch that records a parent
   * and that nothing else records as its parent.
   *
   * `stackInfo` answers for one branch, which is right when you are standing on
   * a stack and useless when you are not — the modal opens on the trunk more
   * often than not. This is how it finds the stacks that exist anyway.
   */
  async stackLeaves(repoPath: string): Promise<string[]> {
    const parents = await readStackParents(gitFor(repoPath))
    const claimed = new Set(parents.values())
    return [...parents.keys()].filter((b) => !claimed.has(b)).sort((a, b) => a.localeCompare(b))
  },

  /**
   * Set the whole route in one move: `order` (bottom → top) sitting on `trunk`,
   * and anything currently in the stack but missing from `order` untracked.
   *
   * The modal edits the stack as a list — swap a stop, drop one, change where it
   * starts — and each of those is this call with a different list. Doing it in
   * one operation is what keeps the undo entry honest: half a re-route is not a
   * state the user asked for.
   */
  async stackSetRoute(repoPath: string, trunk: string, order: string[]): Promise<void> {
    const before = await gitService.stackInfo(repoPath)
    const dropped = before.branches.map((b) => b.name).filter((n) => !order.includes(n))
    // The untracking is part of the same gesture, so it is inside the same
    // snapshot: a conflict half-way through the replay must not leave levels
    // detached from a stack that never changed.
    await withStackRollback(repoPath, [...new Set([...order, ...dropped, trunk])], async (created) => {
      // A stop the user typed that is not a branch yet is created here, on the
      // tip of the stop below it — so "add a stop, then apply" is one gesture
      // and rolls back as one.
      const git = gitFor(repoPath)
      for (let i = 0; i < order.length; i++) {
        const exists = await git.raw(['rev-parse', '--verify', '--quiet', `refs/heads/${order[i]}`]).catch(() => '')
        if (exists.trim()) continue
        await git.raw(['branch', order[i], i === 0 ? trunk : order[i - 1]])
        created.push(order[i])
      }
      for (const name of dropped) await gitService.stackClearParent(repoPath, name)
      if (order.length) await gitService.stackReorder(repoPath, trunk, order)
    })
  },

  /**
   * Add a level directly above `parent` — `gh stack`'s `add`, including in the
   * middle of a stack: whatever level sat on `parent` is re-pointed at the new
   * branch, so the chain keeps its order and gains a floor.
   *
   * No restack follows, and that is deliberate: the branch is created at the
   * parent's tip, so the level that moved onto it sees the same commits it saw
   * before and has nothing to replay.
   */
  async stackInsert(repoPath: string, name: string, parent: string): Promise<void> {
    const git = gitFor(repoPath)
    let child: string | null = null
    for (const [branch, recorded] of await readStackParents(git)) {
      if (recorded !== parent) continue
      child = branch
      break
    }
    await git.raw(['branch', name, parent])
    await gitService.stackSetParent(repoPath, name, parent)
    // Only the link moves — the child's recorded base still marks where its own
    // commits start, and the new level's tip is the same commit it had before.
    if (child && child !== name) await writeStackMeta(git, child, 'parent', name)
    await git.checkout(name)
  },

  /**
   * Restack the chain ending at `leaf`: bottom→top, rebase each branch onto its
   * parent's current tip using the recorded base (so parent rewrites don't
   * duplicate commits). Leaves you back on `leaf`. Throws on conflict.
   */
  async stackRestack(repoPath: string, leaf: string): Promise<void> {
    const git = gitFor(repoPath)
    const info = await gitService.stackInfo(repoPath, leaf)
    // Defence in depth: a restack rebases every level it walks, and a parent
    // link that somehow names a protected branch would rewrite shared history
    // without anyone asking for it.
    const protectedNames = await gitService.protectedBranches(repoPath).catch(() => [] as string[])
    const guarded = info.branches.filter((b) => b.parent && protectedNames.includes(b.name)).map((b) => b.name)
    if (guarded.length) {
      throw new Error(
        `Refusing to rebase protected ${guarded.length === 1 ? 'branch' : 'branches'}: ${guarded.join(', ')}.`
      )
    }
    for (const b of info.branches) {
      if (!b.parent) continue
      const parentTip = (await git.revparse([b.parent])).trim()
      const mergeBase = (await git.raw(['merge-base', parentTip, b.name]).catch(() => '')).trim()
      if (mergeBase === parentTip) {
        // Parent tip already in this branch — nothing to replay.
        await writeStackMeta(git, b.name, 'base', parentTip)
        continue
      }
      let base = await readStackMeta(git, b.name, 'base')
      if (!base) base = (await git.raw(['merge-base', b.parent, b.name])).trim()
      // 3-arg form checks out b.name and rebases its commits since `base` onto parentTip.
      // A conflict here is the only failure a user meets often, so it is named
      // rather than left as git's own paragraph about running `rebase --continue`.
      await git.raw(['rebase', '--onto', parentTip, base, b.name]).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err)
        if (!/conflict/i.test(msg)) throw err
        throw new Error(`${ROUTE_CONFLICT}:${b.name}:${b.parent}`)
      })
      await writeStackMeta(git, b.name, 'base', parentTip)
    }
    await git.checkout(leaf)
  },

  /**
   * Drop stack levels whose PR has landed: while the bottom-most tracked branch
   * is already contained in the trunk (as seen by the last fetch when an
   * origin/<trunk> exists), reparent its child onto the trunk, untrack it, and
   * safe-delete the branch (`-d` refuses anything unmerged; the current branch
   * is left alone). Squash merges are invisible to the local ancestry check;
   * callers pass branches with a host-verified merged PR via `alsoMerged`.
   * Returns the pruned branch names, bottom first.
   */
  async stackPruneMerged(repoPath: string, alsoMerged: string[] = [], leaf?: string): Promise<string[]> {
    const git = gitFor(repoPath)
    const pruned: string[] = []
    let head = leaf
    for (;;) {
      const info = await gitService.stackInfo(repoPath, head)
      const bottom = info.branches[0]
      if (!info.trunk || !bottom) break
      const trunkRef = (await runGit(repoPath, ['rev-parse', '--verify', `origin/${info.trunk}`]).catch(() => ''))
        ? `origin/${info.trunk}`
        : info.trunk
      // `alsoMerged` carries host-side proof (a merged PR) for squash merges,
      // which leave no ancestry a local git can see.
      const merged =
        alsoMerged.includes(bottom.name) ||
        (await runGit(repoPath, ['merge-base', '--is-ancestor', bottom.name, trunkRef]).then(
          () => true,
          () => false
        ))
      if (!merged) break
      const child = info.branches[1]
      if (child) await gitService.stackSetParent(repoPath, child.name, info.trunk)
      await gitService.stackClearParent(repoPath, bottom.name)
      // -D, not -d: git's own safety check measures against HEAD (the leaf),
      // which need not contain the bottom — the ancestor test above already
      // proved the trunk has everything this branch ever was.
      if (!bottom.isCurrent) await git.raw(['branch', '-D', bottom.name]).catch(() => {})
      pruned.push(bottom.name)
      // The leaf survives a prune of the bottom, so keep asking about the same
      // stack rather than falling back to whatever branch is checked out.
      head = info.branches[info.branches.length - 1]?.name ?? head
    }
    return pruned
  },

  async renameBranch(repoPath: string, oldName: string, newName: string): Promise<void> {
    await gitFor(repoPath).branch(['-m', oldName, newName])
  },

  /**
   * Rename a branch and move it on the remote too: local `-m`, delete the old
   * upstream branch, then push the new name and set it as upstream. The remote
   * delete is best-effort (e.g. a protected branch may refuse).
   */
  async renameBranchRemote(repoPath: string, oldName: string, newName: string, remote: string): Promise<void> {
    await gitFor(repoPath).branch(['-m', oldName, newName])
    await withRemoteAuth(repoPath, remote, 'push', async () => {
      await runGit(repoPath, ['push', '--delete', '--', remote, oldName]).catch(() => undefined)
      await runGit(repoPath, ['push', '-u', '--', remote, newName])
    })
  },

  async merge(repoPath: string, ref: string, options: MergeOptions | boolean = {}): Promise<void> {
    const args = mergeArgs(options)
    await withRerereCapture(repoPath, () =>
      withAutoStash(repoPath, `merge ${ref}`, () => gitFor(repoPath).merge([...args, ref]))
    )
  },

  async mergeInto(
    repoPath: string,
    source: string,
    target: string,
    options: MergeOptions | boolean = {}
  ): Promise<void> {
    const git = gitFor(repoPath)
    const args = mergeArgs(options)
    await withRerereCapture(repoPath, () =>
      withAutoStash(repoPath, `merge ${source} into ${target}`, async () => {
        await git.checkout(target)
        await git.merge([...args, source])
      })
    )
  },

  /**
   * The commits behind a conflict: what each side did to this file since they
   * parted.
   *
   * This is `git log --merge`, which git has shipped forever and nobody finds.
   * A conflict marker says *what* clashes; this says *who changed it and why*,
   * which is usually the question that actually decides the resolution.
   */
  async conflictCommits(repoPath: string, file: string): Promise<ConflictCommit[]> {
    const out = await runGit(repoPath, [
      'log',
      '--merge',
      '--left-right',
      `--format=%m${SEP}%H${SEP}%s${SEP}%an${SEP}%aI`,
      '--',
      file
    ]).catch(() => '')
    const commits: ConflictCommit[] = []
    for (const line of out.split('\n')) {
      const [mark, sha, subject, author, date] = line.split(SEP)
      if (!sha) continue
      // `<` is the side already checked out, `>` the one being merged in.
      commits.push({ sha, subject, author, date, side: mark === '<' ? 'ours' : 'theirs' })
    }
    return commits
  },

  async rebase(repoPath: string, onto: string): Promise<void> {
    await withRerereCapture(repoPath, () => gitFor(repoPath).rebase([onto]))
  },

  /** Check out `branch` then rebase it onto `onto` (for the drag-to-rebase gesture). */
  async rebaseOnto(repoPath: string, branch: string, onto: string): Promise<void> {
    const git = gitFor(repoPath)
    await git.checkout(branch)
    await withRerereCapture(repoPath, () => git.rebase([onto]))
  },

  async rebaseAbort(repoPath: string): Promise<void> {
    await gitFor(repoPath).rebase(['--abort'])
  },

  /** Commit the staged changes as a `fixup!` of `targetSha` (for autosquash). */
  async commitFixup(repoPath: string, targetSha: string): Promise<void> {
    await gitFor(repoPath).raw(['commit', `--fixup=${targetSha}`])
  },

  /**
   * Rebase onto `base`, auto-ordering and folding any fixup!/squash! commits.
   * Runs non-interactively (the auto-generated todo is accepted as-is).
   */
  async autosquash(repoPath: string, base: string, autostash = false): Promise<void> {
    // Run via execFile, not simple-git: simple-git refuses both a PAGER env
    // (allowUnsafePager) and `-c core.editor` (allowUnsafeEditor). Real git with
    // these *_EDITOR vars set to true accepts the auto-generated todo without
    // opening an editor.
    // `--autostash` lets the rebase run with a dirty tree (absorb leaves the
    // unattributed changes in place), restoring them afterwards.
    const args = ['-C', repoPath, 'rebase', '-i', '--autosquash']
    if (autostash) args.push('--autostash')
    args.push(base)
    await pexecFile('git', args, {
      env: { ...process.env, GIT_SEQUENCE_EDITOR: 'true', GIT_EDITOR: 'true' }
    })
  },

  /**
   * Squash a contiguous run of the newest commits (HEAD down to and including
   * `oldestSha`) into a single commit with `message`. Implemented as a soft
   * reset to `oldestSha^` followed by one commit, so it only applies when the
   * selection reaches the branch tip. `ORIG_HEAD` is left pointing at the old
   * tip, so undo is a hard reset to it.
   */
  async squashCommits(repoPath: string, oldestSha: string, message: string): Promise<void> {
    const git = gitFor(repoPath)
    await git.raw(['reset', '--soft', `${oldestSha}^`])
    await git.raw(['commit', '-m', message])
  },

  // ─── Sync operations ───────────────────────────────────────────────────────

  /**
   * Returns the refs that were **force-updated** by this fetch — history the
   * remote rewrote under us. `--porcelain` is what makes that knowable without
   * diffing every ref by hand; on a git too old to support it we simply fetch
   * and report nothing.
   */
  async fetchAll(repoPath: string): Promise<ForcedRefUpdate[]> {
    // `--all` spans every remote; authenticate the common case (origin). Other
    // private https remotes without a matching PAT fail fast rather than hang.
    try {
      const out = await withRemoteAuth(repoPath, 'origin', 'fetch', () =>
        runGit(repoPath, ['fetch', '--all', '--prune', '--porcelain'])
      )
      return parseForcedUpdates(out)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!/unknown option|porcelain/i.test(message)) throw err
      await withRemoteAuth(repoPath, 'origin', 'fetch', () => runGit(repoPath, ['fetch', '--all', '--prune']))
      return []
    }
  },

  /**
   * When this repository last fetched, from `FETCH_HEAD`'s mtime. Reading the
   * file rather than trusting our own bookkeeping is the point: a `git fetch`
   * run in a terminal, or by another Gitcito window, counts the same as ours.
   * Null when the repository has never fetched.
   */
  async lastFetchAt(repoPath: string): Promise<number | null> {
    try {
      const rel = (await gitFor(repoPath).raw(['rev-parse', '--git-path', 'FETCH_HEAD'])).trim()
      return (await stat(rel.startsWith('/') ? rel : join(repoPath, rel))).mtimeMs
    } catch {
      return null
    }
  },

  async pull(repoPath: string, mode: 'default' | 'ff-only' | 'rebase' = 'default'): Promise<void> {
    const remote = await upstreamRemote(repoPath)
    const args = ['pull']
    if (mode === 'ff-only') args.push('--ff-only')
    if (mode === 'rebase') args.push('--rebase')
    await withRerereCapture(repoPath, () =>
      withAutoStash(repoPath, 'pull', () => withRemoteAuth(repoPath, remote, 'fetch', () => runGit(repoPath, args)))
    )
  },

  /**
   * What a "there is no tracking information" pull is actually missing. Git
   * prints the two repairs as CLI incantations and leaves the user to pick;
   * this answers the question the choice hinges on — whether the remote already
   * carries the branch — so the UI can offer one button instead of a man page.
   * Returns null when there is nothing to repair (detached HEAD, an upstream
   * already set, or no remote at all).
   */
  async upstreamSuggestion(repoPath: string): Promise<UpstreamSuggestion | null> {
    const branch = await runGit(repoPath, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
      .then((s) => s.trim())
      .catch(() => '')
    if (!branch) return null
    if (await branchUpstream(repoPath, branch)) return null
    const remotes = await gitService.remotes(repoPath)
    if (!remotes.length) return null
    const remote = remotes.some((r) => r.name === 'origin') ? 'origin' : remotes[0].name
    // Reads the remote-tracking ref, not the network: a fetch has just run, so
    // this is current, and an offline repo still gets a sensible answer.
    const remoteRefExists = await runGit(repoPath, [
      'rev-parse',
      '--verify',
      '--quiet',
      `refs/remotes/${remote}/${branch}`
    ])
      .then((s) => !!s.trim())
      .catch(() => false)
    return { branch, remote, remoteRefExists }
  },

  /**
   * Every `*.lock` file left inside the repository's git directory, newest
   * first, with its age.
   *
   * Git writes a lock next to whatever it is about to change and removes it
   * when the write lands. A lock that outlives its process — a crashed editor,
   * a `git commit` whose terminal was closed, a killed fetch mid-prune — is
   * invisible from the UI and turns every later write into
   * "Unable to create '...lock': File exists". The age is the whole story: a
   * lock two seconds old belongs to a running git, one twenty minutes old does
   * not.
   *
   * Submodule git directories (`modules/`) and the pack directory are skipped —
   * the first belongs to another repository, the second holds no lock a user
   * can act on.
   */
  async staleLocks(repoPath: string): Promise<GitLockFile[]> {
    const dirs = new Set<string>()
    for (const arg of ['--absolute-git-dir', '--git-common-dir']) {
      const raw = (await runGit(repoPath, ['rev-parse', arg]).catch(() => '')).trim()
      if (raw) dirs.add(resolvePath(repoPath, raw))
    }
    const now = Date.now()
    const found: GitLockFile[] = []
    for (const gitDir of dirs) {
      const walk = async (dir: string, rel: string): Promise<void> => {
        const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
        for (const e of entries) {
          const child = rel ? `${rel}/${e.name}` : e.name
          if (e.isDirectory()) {
            if (child === 'modules' || child === 'objects/pack' || child === 'lfs') continue
            await walk(join(dir, e.name), child)
            continue
          }
          if (!e.name.endsWith('.lock')) continue
          const st = await stat(join(dir, e.name)).catch(() => null)
          if (!st) continue
          found.push({
            path: child,
            ageSeconds: Math.max(0, Math.round((now - st.mtimeMs) / 1000)),
            kind: lockKind(child)
          })
        }
      }
      await walk(gitDir, '')
    }
    // Same file reachable through both git dirs (a plain repo answers the same
    // path twice) — one entry per path.
    const byPath = new Map(found.map((f) => [f.path, f]))
    return [...byPath.values()].sort((a, b) => a.ageSeconds - b.ageSeconds)
  },

  /**
   * Delete lock files by the relative paths `staleLocks` reported. Returns how
   * many actually went.
   *
   * Three guards, because this deletes files inside `.git` on a path that
   * starts in the renderer: the name must end in `.lock`, it must resolve
   * inside one of the repository's git directories (no `..` escape), and it
   * must be older than `MIN_LOCK_AGE_SECONDS` — a young lock is a git process
   * still running, and removing it from under a live write is how a repository
   * gets a torn index.
   */
  async clearLocks(repoPath: string, paths: string[]): Promise<number> {
    const dirs: string[] = []
    for (const arg of ['--absolute-git-dir', '--git-common-dir']) {
      const raw = (await runGit(repoPath, ['rev-parse', arg]).catch(() => '')).trim()
      if (raw) dirs.push(resolvePath(repoPath, raw))
    }
    let removed = 0
    for (const rel of paths) {
      if (!rel.endsWith('.lock') || rel.includes('\0')) continue
      for (const gitDir of dirs) {
        const target = resolvePath(gitDir, rel)
        if (!target.startsWith(gitDir + sep)) continue
        const st = await stat(target).catch(() => null)
        if (!st || !st.isFile()) continue
        if ((Date.now() - st.mtimeMs) / 1000 < MIN_LOCK_AGE_SECONDS) continue
        await unlink(target).catch(() => undefined)
        removed++
        break
      }
    }
    return removed
  },

  /** Point `branch` at `<remote>/<branch>`; a null remote unsets the tracking. */
  async setUpstream(repoPath: string, branch: string, remote: string | null): Promise<void> {
    if (remote === null) await runGit(repoPath, ['branch', '--unset-upstream', branch])
    else await runGit(repoPath, ['branch', `--set-upstream-to=${remote}/${branch}`, branch])
  },

  async push(repoPath: string, branch: string, opts: { force?: boolean; remote?: string } = {}): Promise<void> {
    const remote = opts.remote ?? 'origin'
    const args = ['push']
    if (opts.force) args.push('--force-with-lease')
    args.push('--set-upstream', '--', remote, branch)
    await withRemoteAuth(repoPath, remote, 'push', () => runGit(repoPath, args))
  },

  /**
   * Push local branch `local` to `remoteBranch` on `remote` — a different name
   * than its own, as dropping a branch on another's remote counterpart means
   * ("push feature to origin/main"). Never forced: the remote refuses anything
   * that is not a fast-forward, which is the safety this gesture needs. The
   * local branch's upstream is left alone.
   */
  async pushRef(repoPath: string, local: string, remote: string, remoteBranch: string): Promise<void> {
    if (![local, remote, remoteBranch].every(isPlainRef)) throw new Error(`Not a branch name: ${local}`)
    await withRemoteAuth(repoPath, remote, 'push', () =>
      runGit(repoPath, ['push', '--', remote, `refs/heads/${local}:refs/heads/${remoteBranch}`])
    )
  },

  /**
   * Update a local branch from its upstream **without checking it out**.
   *
   * `git pull` only ever moves HEAD, which is why a branch you are not standing
   * on looks unpullable. A refspec fetch moves the ref directly, and git refuses
   * it unless the update is a fast-forward — that refusal is the point: a
   * diverged branch needs a merge or rebase the user picked, not a silent one.
   */
  async pullBranch(repoPath: string, branch: string): Promise<void> {
    const head = await runGit(repoPath, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
      .then((s) => s.trim())
      .catch(() => '')
    // Standing on it? Then the ordinary pull is both possible and better — it
    // updates the working tree too.
    if (head && head === branch) return gitService.pull(repoPath, 'default')

    const upstream = await branchUpstream(repoPath, branch)
    if (!upstream) throw new Error(`'${branch}' has no upstream branch to pull from.`)
    const slash = upstream.indexOf('/')
    const remote = upstream.slice(0, slash)
    const remoteBranch = upstream.slice(slash + 1)
    try {
      await withRemoteAuth(repoPath, remote, 'fetch', () =>
        runGit(repoPath, ['fetch', '--', remote, `${remoteBranch}:${branch}`])
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/non-fast-forward|rejected/i.test(message))
        throw new Error(
          `'${branch}' has diverged from ${upstream}. Check it out and merge or rebase to reconcile them.`
        )
      throw err
    }
  },

  /**
   * Move a local branch to `sha` without checking it out — `git branch -f`.
   *
   * The undo for a branch-level pull. Git refuses to move a branch that is
   * checked out in this worktree or another one, which is the guard we want.
   */
  async setBranchRef(repoPath: string, branch: string, sha: string): Promise<void> {
    await runGit(repoPath, ['branch', '-f', branch, sha])
  },

  /**
   * Move a local branch to `sha` (a commit dropped on its badge) and return
   * where it pointed before — the undo's target. Same guard as setBranchRef:
   * git refuses to move a branch checked out in any worktree.
   */
  async moveBranchTo(repoPath: string, branch: string, sha: string): Promise<string> {
    const before = (await runGit(repoPath, ['rev-parse', '--verify', `refs/heads/${branch}^{commit}`])).trim()
    await runGit(repoPath, ['branch', '-f', branch, sha])
    return before
  },

  /**
   * Which of `shas` are commits this repository has — a pull request's commits
   * that can open here rather than on the host. One `cat-file --batch-check`
   * for the whole list. Only full hex ids are asked about: they come from a
   * hosting API, and anything else could name a ref or read as an option.
   */
  async getLocalCommits(repoPath: string, shas: unknown): Promise<string[]> {
    const isFullSha = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(s)
    // Capped like the Commits tab itself: a caller cannot make one call any size.
    const wanted = Array.isArray(shas) ? [...new Set(shas.filter(isFullSha))].slice(0, 500) : []
    if (!wanted.length) return []
    const out = await gitWithStdin(
      repoPath,
      ['cat-file', '--batch-check=%(objectname) %(objecttype)'],
      wanted.map((s) => `${s}\n`).join(''),
      // A partial clone would fetch a missing object from its promisor remote —
      // a network write inside a read. Missing stays missing (git 2.44+; older
      // versions ignore the variable).
      { GIT_NO_LAZY_FETCH: '1' }
    ).catch(() => '')
    const found = new Set<string>()
    for (const line of out.split('\n')) {
      const [sha, type] = line.trim().split(' ')
      if (type === 'commit') found.add(sha.toLowerCase())
    }
    return wanted.filter((s) => found.has(s.toLowerCase()))
  },

  /**
   * The files changed between two commits, each with its patch — what one
   * push to a pull request did, for its Updates tab, and a whole pull request
   * (merge base → head) for its Files tab. The two trees directly (`from to`,
   * not the merge base), renames detected. Only full hex ids, as
   * getLocalCommits; no external diff or textconv, so the patch is git's own
   * and a repository's config cannot run a program from here.
   *
   * No cap on the number of files. A file over RANGE_FILE_LINE_CAP changed
   * lines is listed with its counts and `tooLarge` instead of its patch — a
   * generated lockfile must not hold the rest up or fill the output buffer.
   * A file git calls binary is read again as bytes (decodeFileBytes): UTF-16
   * text is binary to git and plain text to a reviewer. `paths` limits it to
   * those files (a renamed file's two paths) — one file read again on demand.
   */
  async getCommitRangeFiles(repoPath: string, from: unknown, to: unknown, paths?: unknown): Promise<PrFile[]> {
    const isFullSha = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(s)
    if (!isFullSha(from) || !isFullSha(to)) throw new Error('Two full commit ids are compared.')
    const only: unknown[] = Array.isArray(paths) ? paths : []
    if (only.length > 1000 || !only.every((p) => typeof p === 'string' && p !== '' && !p.includes('\0'))) {
      throw new Error('Refusing those paths.')
    }
    const spec = (only as string[]).map((p) => `:(top,literal)${p}`)
    const env = { GIT_NO_LAZY_FETCH: '1' }
    const plain = ['--no-color', '--no-ext-diff', '--no-textconv', '-M']
    const counts = parseNumstatZ(
      await runGit(repoPath, ['diff', '--numstat', '-z', ...plain, from, to, '--', ...spec], env, 64 << 20)
    )
    const large = counts.filter((c) => !c.binary && c.additions + c.deletions > RANGE_FILE_LINE_CAP)
    const skip = large.flatMap((c) => (c.oldPath ? [c.oldPath, c.path] : [c.path]))
    const out = await runGit(
      repoPath,
      ['diff', ...DIFF_PREFIXES, ...plain, from, to, '--', ...spec, ...skip.map((p) => `:(top,exclude,literal)${p}`)],
      env,
      RANGE_DIFF_MAX_BUFFER
    )
    const files = splitUnifiedDiff(out)
    if (large.length) files.push(...(await largeRangeFiles(repoPath, from, to, large)))
    await rereadBinaryAsText(repoPath, from, to, files)
    // In git's own order, which the numstat kept: the large ones were appended.
    const order = new Map(counts.map((c, i) => [c.path, i]))
    return files.sort((a, b) => (order.get(a.filename) ?? 0) - (order.get(b.filename) ?? 0))
  },

  /**
   * The best common ancestor of two commits — where a pull request's diff
   * starts, as every host computes it. Null when either commit is not here or
   * they share no history. Full ids only; no lazy fetch.
   */
  async getMergeBase(repoPath: string, a: unknown, b: unknown): Promise<string | null> {
    const isFullSha = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(s)
    if (!isFullSha(a) || !isFullSha(b)) throw new Error('Two full commit ids are compared.')
    const out = (await runGit(repoPath, ['merge-base', a, b], { GIT_NO_LAZY_FETCH: '1' }).catch(() => '')).trim()
    return isFullSha(out) ? out : null
  },

  /**
   * Bring single commits down from `remote` by their ids — the two heads of a
   * pull request update, so getCommitRangeFiles can compare them here. A head
   * a force push replaced is on no branch any more, but most hosts still serve
   * it by id. Nothing but FETCH_HEAD moves: no ref, no tag. A write all the
   * same (objects and FETCH_HEAD), so not a READ_METHOD. Only full hex ids and
   * a configured remote reach the command line. True when every commit is here
   * afterwards; false when the server would not give them.
   */
  async fetchCommitsById(repoPath: string, remote: string, shas: unknown): Promise<boolean> {
    const isFullSha = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(s)
    const wanted = Array.isArray(shas) ? [...new Set(shas)] : []
    if (!wanted.length || wanted.length > 4 || !wanted.every(isFullSha)) throw new Error('Commits are fetched by their full ids.')
    await assertConfiguredRemote(repoPath, remote)
    try {
      await withRemoteAuth(repoPath, remote, 'fetch', () =>
        runGit(repoPath, ['fetch', '--no-tags', '--', remote, ...wanted])
      )
    } catch {
      // A server that serves no unadvertised commit, or one that is gone: the caller asks the host.
      return false
    }
    return (await gitService.getLocalCommits(repoPath, wanted)).length === wanted.length
  },

  /**
   * Whether `ancestor` is a strict ancestor of `descendant`: the one can be
   * fast-forwarded to the other. False for the same commit (nothing to move),
   * for an unknown ref, and for a name that would read as an option.
   */
  async isAncestor(repoPath: string, ancestor: string, descendant: string): Promise<boolean> {
    if (!isPlainRef(ancestor) || !isPlainRef(descendant)) return false
    const sha = (ref: string): Promise<string> =>
      runGit(repoPath, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).then((o) => o.trim(), () => '')
    const [a, d] = await Promise.all([sha(ancestor), sha(descendant)])
    if (!a || !d || a === d) return false
    return runGit(repoPath, ['merge-base', '--is-ancestor', a, d]).then(
      () => true,
      () => false
    )
  },

  /**
   * Move local branch `target` forward to `source` without checking it out —
   * a fast-forward, refused when it would not be one. The branch checked out
   * here is left to merge (which already fast-forwards when it can), and one
   * checked out in another worktree is refused by `git branch -f` itself, so
   * no worktree's index is left behind a moved branch. Returns the commit the
   * branch was on, for undo.
   */
  async fastForwardBranch(repoPath: string, target: string, source: string): Promise<string> {
    if (!isPlainRef(target) || !isPlainRef(source)) throw new Error(`Not a branch name: ${target}`)
    const head = await runGit(repoPath, ['symbolic-ref', '--quiet', '--short', 'HEAD']).then((s) => s.trim(), () => '')
    if (head === target) throw new Error(`${target} is checked out — merge ${source} into it instead.`)
    const before = (await runGit(repoPath, ['rev-parse', '--verify', `refs/heads/${target}^{commit}`])).trim()
    const after = (await runGit(repoPath, ['rev-parse', '--verify', `${source}^{commit}`])).trim()
    const ff = await runGit(repoPath, ['merge-base', '--is-ancestor', before, after]).then(() => true, () => false)
    if (!ff || before === after) throw new Error(`${target} cannot be fast-forwarded to ${source}: they have diverged.`)
    await runGit(repoPath, ['branch', '-f', target, after])
    return before
  },

  /**
   * Push one branch to several remotes in turn.
   *
   * A failure against one remote does not cancel the others: pushing a fork and
   * its upstream is the whole point, and "upstream rejected it" is no reason to
   * leave the fork behind. Each result is reported separately.
   */
  async pushToRemotes(
    repoPath: string,
    branch: string,
    remotes: string[],
    opts: { force?: boolean; tags?: boolean } = {}
  ): Promise<PushRemoteResult[]> {
    const targets = remotes.map((r) => r.trim()).filter(Boolean)
    if (!targets.length) throw new Error('Choose at least one remote.')

    const results: PushRemoteResult[] = []
    for (const remote of targets) {
      const args = ['push']
      if (opts.force) args.push('--force-with-lease')
      // Only the first remote's push sets the upstream — a branch has one, and
      // the last remote pushed to is not automatically the one to track.
      if (remote === targets[0]) args.push('--set-upstream')
      if (opts.tags) args.push('--follow-tags')
      args.push('--', remote, branch)
      try {
        await withRemoteAuth(repoPath, remote, 'push', () => runGit(repoPath, args))
        results.push({ remote, ok: true, error: '' })
      } catch (err) {
        // A return value, not a throw: the dispatcher's redaction never sees it.
        results.push({ remote, ok: false, error: redactCredentials(err instanceof Error ? err.message : String(err)) })
      }
    }
    return results
  },

  /**
   * Every local branch against `remote`: ahead/behind, whether the remote has
   * it, and so whether a plain push would go through. One `for-each-ref` for
   * the branches and their upstream tracking, one for the remote's refs; a
   * `rev-list` only for the few branches that are compared against a remote
   * branch they do not track and do not match.
   */
  async branchPushStates(repoPath: string, remote: string): Promise<BranchPushState[]> {
    if (!isPlainRef(remote)) throw new Error(`Not a remote name: ${remote}`)
    const [rows, remoteOut, remoteDefault] = await Promise.all([
      localBranchRows(repoPath),
      runGit(repoPath, ['for-each-ref', '--format=%(refname)%00%(objectname)', `refs/remotes/${remote}/`]),
      remoteDefaultBranch(repoPath, remote)
    ])
    const remoteShas = new Map<string, string>()
    for (const line of remoteOut.split('\n')) {
      const [ref, sha] = line.split('\0')
      if (ref && sha) remoteShas.set(ref, sha)
    }
    const states: BranchPushState[] = []
    const toCount: { into: { ahead: number; behind: number }; sha: string; remoteSha: string }[] = []
    for (const row of rows) {
      // Always the branch's own name: where `git push` would send it by default.
      const remoteSha = remoteShas.get(`refs/remotes/${remote}/${row.name}`)
      const state: BranchPushState = {
        name: row.name,
        sha: row.sha,
        isCurrent: row.isCurrent,
        upstream: row.upstream,
        remoteBranch: row.name,
        remoteExists: !!remoteSha,
        ahead: 0,
        behind: 0,
        state: 'new',
        upstreamTarget: null
      }
      if (remoteSha && remoteSha !== row.sha) {
        // The upstream's counts are free when the upstream is this very
        // destination; anything else needs a rev-list.
        const tracked = row.upstreamRemote === remote && row.upstream === `${remote}/${row.name}`
        if (tracked && row.track) Object.assign(state, trackCounts(row.track))
        else toCount.push({ into: state, sha: row.sha, remoteSha })
      }
      const other = otherNamedUpstream(row, remote)
      if (other !== null && row.upstream) {
        const upSha = remoteShas.get(`refs/remotes/${row.upstream}`)
        const target: UpstreamPushTarget = {
          remoteBranch: other,
          remoteExists: !!upSha,
          ahead: 0,
          behind: 0,
          state: 'new',
          isRemoteDefault: other === remoteDefault
        }
        if (upSha && upSha !== row.sha) {
          if (row.track) Object.assign(target, trackCounts(row.track))
          else toCount.push({ into: target, sha: row.sha, remoteSha: upSha })
        }
        state.upstreamTarget = target
      }
      states.push(state)
    }
    for (let i = 0; i < toCount.length; i += 8) {
      await Promise.all(
        toCount.slice(i, i + 8).map(async ({ into, sha, remoteSha }) => {
          const out = await runGit(repoPath, ['rev-list', '--left-right', '--count', `${sha}...${remoteSha}`])
            .catch(() => '')
          const [ahead, behind] = out.trim().split(/\s+/).map((n) => Number(n) || 0)
          into.ahead = ahead ?? 0
          into.behind = behind ?? 0
        })
      )
    }
    for (const s of states) {
      s.state = classifyPushState(s.ahead, s.behind, s.remoteExists)
      const up = s.upstreamTarget
      if (up) up.state = classifyPushState(up.ahead, up.behind, up.remoteExists)
    }
    return states
  },

  /**
   * The files each branch would publish to `remote` — every path touched by a
   * commit on the branch that none of the remote's tracking refs has. What the
   * secret guard checks before a multi-branch push. History, not the tip:
   * a key added and deleted again is still in the commits that go out.
   *
   * A branch whose files cannot be listed at all is left out of the result,
   * never answered with an empty list: the renderer holds a missing branch as
   * unchecked, where `[]` would have read as clean and pushed it unguarded.
   */
  async outgoingFiles(repoPath: string, remote: string, branches: string[]): Promise<Record<string, string[]>> {
    if (!isPlainRef(remote)) throw new Error(`Not a remote name: ${remote}`)
    const out: Record<string, string[]> = {}
    const names = [...new Set(branches)].filter(isPlainRef)
    for (let i = 0; i < names.length; i += 8) {
      await Promise.all(
        names.slice(i, i + 8).map(async (branch) => {
          const raw = await runGit(
            repoPath,
            ['log', '--format=', '--name-only', '-z', `refs/heads/${branch}`, '--not', `--remotes=${remote}`],
            undefined,
            256 * 1024 * 1024
          ).catch(() =>
            // A history too large to list: fall back to the files at the tip.
            runGit(repoPath, ['ls-tree', '-r', '-z', '--name-only', `refs/heads/${branch}`], undefined, 256 * 1024 * 1024)
              .catch(() => null)
          )
          if (raw !== null) out[branch] = [...new Set(raw.split(/[\0\n]/).filter(Boolean))]
        })
      )
    }
    return out
  },

  /**
   * Push several local branches to one remote in a single `git push`, without
   * checking any of them out. Each lands on its own name — the branches in
   * `toUpstream` (an explicit, confirmed choice in the dialog) on their
   * upstream's name instead, when that differs. Never forced — no `+`
   * refspec, no `--force` — so the remote refuses anything that is not a
   * fast-forward, and that refusal is reported per branch rather than thrown.
   * `atomic` makes it all or nothing. `setUpstream` links each branch that had
   * no upstream and made it to the remote.
   */
  async pushBranches(
    repoPath: string,
    remote: string,
    branches: string[],
    opts: { setUpstream: boolean; atomic?: boolean; toUpstream?: string[] }
  ): Promise<PushBranchesResult> {
    if (!isPlainRef(remote)) throw new Error(`Not a remote name: ${remote}`)
    const wanted = [...new Set(branches)]
    if (!wanted.length) throw new Error('Choose at least one branch to push.')
    const bad = wanted.find((b) => !isPlainRef(b))
    if (bad !== undefined) throw new Error(`Not a branch name: ${bad}`)
    const rows = new Map((await localBranchRows(repoPath)).map((r) => [r.name, r]))
    const missing = wanted.find((b) => !rows.has(b))
    if (missing !== undefined) throw new Error(`No local branch named ${missing}.`)

    const toUpstream = new Set(opts.toUpstream ?? [])
    const targets: PushTarget[] = wanted.map((branch) => {
      if (!toUpstream.has(branch)) return { branch, remoteBranch: branch }
      const other = otherNamedUpstream(rows.get(branch)!, remote)
      if (other === null) throw new Error(`${branch} does not track a differently named branch on ${remote}.`)
      return { branch, remoteBranch: other }
    })
    // git would refuse the whole push anyway; say which branches collide.
    const clash = duplicateDestinations(targets)[0]
    if (clash) {
      throw new Error(`${clash.branches.join(' and ')} would all push to ${remote}/${clash.remoteBranch}. Push one of them.`)
    }
    const args = ['push', '--porcelain']
    if (opts.atomic) args.push('--atomic')
    args.push('--', remote, ...pushRefspecs(targets))
    const run = await withRemoteAuth(repoPath, remote, 'push', () => runGitCapture(repoPath, args))
    const refs = parsePushPorcelain(run.stdout)
    // No per-ref report at all: the push never got as far as the refs (auth,
    // an unknown remote, a server without --atomic). That is a plain failure.
    if (run.code !== 0 && refs.length === 0) throw new Error(run.stderr.trim() || 'git push failed')

    const results: BranchPushResult[] = pushResultsFrom(targets, refs)
    if (opts.setUpstream) {
      // Plain config writes rather than `-u`: that would also re-point a branch
      // that already tracks another remote, which is not what was asked.
      for (const r of results) {
        if (r.status === 'rejected' || r.status === 'notAttempted' || rows.get(r.branch)?.upstream) continue
        await runGit(repoPath, ['config', `branch.${r.branch}.remote`, remote])
        await runGit(repoPath, ['config', `branch.${r.branch}.merge`, `refs/heads/${r.remoteBranch}`])
        r.upstreamSet = true
      }
    }
    return { remote, atomic: !!opts.atomic, results, remoteMessages: remoteMessages(run.stderr) }
  },

  /** Publish every local tag to a remote. Annotated and lightweight alike. */
  async pushAllTags(repoPath: string, remote = 'origin'): Promise<void> {
    await withRemoteAuth(repoPath, remote, 'push', () => runGit(repoPath, ['push', '--tags', '--', remote]))
  },

  // ─── Stash operations ──────────────────────────────────────────────────────

  async stash(repoPath: string, message?: string): Promise<void> {
    const args = ['push', '--include-untracked']
    if (message) args.push('-m', message)
    await gitFor(repoPath).stash(args)
  },

  /**
   * Stash a chosen subset of changes (partial stash). With `paths`, only those
   * pathspecs are stashed; empty/omitted stashes everything. `keepIndex` leaves
   * the staged index intact in the working tree (`git stash push --keep-index`).
   */
  async stashPush(
    repoPath: string,
    message?: string,
    paths?: string[],
    keepIndex = false
  ): Promise<void> {
    const args = ['push', '--include-untracked']
    if (keepIndex) args.push('--keep-index')
    if (message) args.push('-m', message)
    if (paths && paths.length) args.push('--', ...paths)
    await gitFor(repoPath).stash(args)
  },

  async stashPop(repoPath: string, index = 0): Promise<void> {
    await gitFor(repoPath).stash(['pop', `stash@{${index}}`])
  },

  async stashApply(repoPath: string, index = 0): Promise<void> {
    await gitFor(repoPath).stash(['apply', `stash@{${index}}`])
  },

  async stashDrop(repoPath: string, index = 0): Promise<void> {
    await gitFor(repoPath).stash(['drop', `stash@{${index}}`])
  },

  /**
   * Create a new branch from a stash and apply it there (`git stash branch`).
   * Branches off the commit the stash was made on, checks it out, applies the
   * stash, and drops it on success — handy when a stash won't apply cleanly onto
   * the current branch.
   */
  async stashToBranch(repoPath: string, branch: string, index = 0): Promise<void> {
    await gitFor(repoPath).stash(['branch', branch, `stash@{${index}}`])
  },

  /**
   * Rename a stash by rewriting its reflog subject in place. Git has no native
   * rename, but `stash@{n}` is just an entry in `logs/refs/stash` — editing the
   * message after the tab keeps the stash's commit and stack position intact.
   * The `WIP on <branch>:` / `On <branch>:` prefix is preserved so the branch
   * label still shows; only the user-facing message is replaced.
   */
  async renameStash(repoPath: string, index: number, message: string): Promise<void> {
    const git = gitFor(repoPath)
    let logPath = (await git.raw(['rev-parse', '--git-path', 'logs/refs/stash'])).trim()
    if (!logPath) throw new Error('No stash reflog found')
    if (!logPath.startsWith('/')) logPath = join(repoPath, logPath)
    const raw = await readFile(logPath, 'utf8')
    const lines = raw.split('\n')
    // The reflog is oldest-first, so stash@{0} is the last non-empty line.
    const nonEmpty: number[] = []
    lines.forEach((l, i) => l.length > 0 && nonEmpty.push(i))
    const target = nonEmpty.length - 1 - index
    if (target < 0 || target >= nonEmpty.length) throw new Error(`No stash at index ${index}`)
    const fileIdx = nonEmpty[target]
    const tab = lines[fileIdx].indexOf('\t')
    if (tab < 0) throw new Error('Malformed stash reflog entry')
    const meta = lines[fileIdx].slice(0, tab)
    const subject = lines[fileIdx].slice(tab + 1)
    const prefix = /^((?:WIP on|On) [^:]*:\s*)/.exec(subject)?.[1] ?? ''
    lines[fileIdx] = `${meta}\t${prefix}${message.trim()}`
    // split/join round-trips the trailing newline (last element stays '').
    await writeFile(logPath, lines.join('\n'), 'utf8')
  },

  async stashApplyFiles(repoPath: string, sha: string, tracked: string[], untracked: string[]): Promise<void> {
    const git = gitFor(repoPath)
    if (tracked.length) await git.raw(['restore', '--source', sha, '--worktree', '--', ...tracked])
    if (untracked.length) await git.raw(['restore', '--source', `${sha}^3`, '--worktree', '--', ...untracked])
  },

  /**
   * Save what is staged and what is on disk as two trees, right before a
   * discard, so `restoreWork` can undo it exactly. Writes objects only: no ref,
   * the real index untouched. Null when there is nothing to save, or when the
   * index cannot be written as a tree (a merge still has conflicts).
   * With `paths` (the paths about to be discarded) the disk sweep is scoped to
   * them — `restoreWork` only ever restores those, so rehashing every dirty
   * file in the repo would be work thrown away.
   */
  async captureWork(repoPath: string, paths?: string[]): Promise<SavedWork | null> {
    const index = (await runGit(repoPath, ['write-tree']).catch(() => '')).trim()
    if (!index) return null
    const gitDir = (await runGit(repoPath, ['rev-parse', '--absolute-git-dir'])).trim()
    const tmpIndex = join(gitDir, `githuttbr-save-${process.pid}-${Date.now()}`)
    const env = { GIT_INDEX_FILE: tmpIndex }
    try {
      // Seeded from a copy of the real index, so `add -A` in the throwaway one
      // records the disk on top of what is staged — untracked files included,
      // ignored ones not (a discard leaves those alone anyway). A copy keeps the
      // stat cache, so only changed files are hashed; `read-tree` would rehash
      // the whole tree. No index yet (nothing ever staged) seeds from the tree.
      const realIndex = resolvePath(repoPath, (await runGit(repoPath, ['rev-parse', '--git-path', 'index'])).trim())
      const copied = await cp(realIndex, tmpIndex).then(() => true, () => false)
      if (!copied) await runGit(repoPath, ['read-tree', index], env)
      await runGit(repoPath, ['--literal-pathspecs', 'add', '-A', ...(paths?.length ? ['--', ...paths] : [])], env)
      const worktree = (await runGit(repoPath, ['write-tree'], env)).trim()
      return worktree ? { index, worktree } : null
    } catch {
      return null
    } finally {
      await unlink(tmpIndex).catch(() => {})
    }
  },

  /**
   * Put `paths` back as `captureWork` saved them: their staged version into the
   * index, their content on disk. Only those paths — anything else may have
   * moved on since and is left alone. A path that did not exist then is removed.
   */
  async restoreWork(repoPath: string, saved: SavedWork, paths: string[]): Promise<void> {
    if (!isObjectId(saved.index) || !isObjectId(saved.worktree)) throw new Error('Invalid saved work')
    // The containment check stays per path — it is cheap fs work and it is the
    // guard that keeps a crafted path from reaching outside the repository.
    for (const path of paths) {
      if (!(await containedPath(repoPath, path))) {
        throw new Error(`Refusing to restore outside the repository: ${path}`)
      }
    }
    // Two probes classify all paths at once; two restores then move them all.
    // The old per-file loop paid ~3 spawns per path — undo of a large discard
    // felt as slow as the discard itself.
    const inIndexTree = await probePaths(repoPath, [
      'ls-tree', '-r', '-z', '--name-only', saved.index, '--', ...paths
    ])
    const inWorkTree = await probePaths(repoPath, [
      'ls-tree', '-r', '-z', '--name-only', saved.worktree, '--', ...paths
    ])
    const staged = paths.filter((p) => pathspecMatches(inIndexTree, p))
    const worktree = paths.filter((p) => pathspecMatches(inWorkTree, p))
    try {
      if (staged.length) {
        await runGit(repoPath, ['--literal-pathspecs', 'restore', '--source', saved.index, '--staged', '--', ...staged])
      }
      if (worktree.length) {
        await runGit(repoPath, ['--literal-pathspecs', 'restore', '--source', saved.worktree, '--worktree', '--', ...worktree])
      }
    } catch {
      // A batch restore is all-or-nothing — one odd path fails it whole, so
      // replay every path through the per-file tolerance the old loop had.
      for (const path of paths) await restoreWorkPath(repoPath, saved, path)
      return
    }
    // Paths absent from the saved worktree tree did not exist then — remove.
    for (const path of paths) {
      if (pathspecMatches(inWorkTree, path)) continue
      const full = await containedPath(repoPath, path)
      if (full) await rm(full, { force: true }).catch(() => {})
    }
  },

  /** Overwrite the working copies of `paths` with their content at `hash` —
   *  "take these changes" from a commit without touching HEAD or the index. */
  async restoreFromCommit(repoPath: string, hash: string, paths: string[]): Promise<void> {
    if (!paths.length) return
    await guardSnapshot(repoPath)
    const git = gitFor(repoPath)
    await git.raw(['restore', '--source', hash, '--worktree', '--', ...paths])
  },

  /**
   * Force-apply (or pop) a stash whose untracked files collide with files that
   * already exist in the working tree. Plain `git stash apply` aborts with
   * "could not restore untracked files from stash" rather than clobber them, so
   * we delete the colliding untracked paths — they're about to be replaced by the
   * stash's own copies — then retry the apply/pop.
   */
  async stashApplyOverwrite(repoPath: string, index = 0, pop = false): Promise<void> {
    const git = gitFor(repoPath)
    const ref = `stash@{${index}}`
    const sha = (await git.raw(['rev-parse', ref])).trim()
    // The untracked tree (`^3`) exists only when the stash was made with -u.
    const listed = await git.raw(['ls-tree', '-r', '-z', '--name-only', `${sha}^3`]).catch(() => '')
    for (const rel of listed.split('\0').filter(Boolean)) {
      const abs = join(repoPath, rel)
      if (existsSync(abs)) await unlink(abs).catch(() => {})
    }
    await gitFor(repoPath).stash([pop ? 'pop' : 'apply', ref])
  },

  // ─── Working directory / commits ───────────────────────────────────────────

  async stage(repoPath: string, files: string[]): Promise<void> {
    await gitFor(repoPath).add(files)
  },

  async stageAll(repoPath: string): Promise<void> {
    await gitFor(repoPath).add(['-A'])
  },

  async unstage(repoPath: string, files: string[]): Promise<void> {
    await gitFor(repoPath).raw(['restore', '--staged', '--', ...files])
  },

  async unstageAll(repoPath: string): Promise<void> {
    await gitFor(repoPath).raw(['reset', 'HEAD', '--', '.'])
  },

  // ─── Object replacement (`git replace`) ────────────────────────────────────
  // A replacement is a ref that says "wherever you were going to read object A,
  // read B instead". Nothing is rewritten and no sha changes — which makes it
  // the honest way to shorten a clone's history without the violence of a
  // filter-branch, and a genuinely dangerous thing to leave lying around
  // unexplained, since the history everyone sees is no longer the history that
  // is stored.

  /** Every replacement, with enough of each side to tell them apart. */
  async replacements(repoPath: string): Promise<ReplaceStatus> {
    const listed = await runGit(repoPath, ['replace', '-l', '--format=long']).catch(() => '')
    const refs: ReplaceRef[] = []
    for (const line of listed.split('\n')) {
      // "<original> (<type>) -> <replacement> (<type>)"
      const match = /^([0-9a-f]{40,64})\s+\([^)]*\)\s+->\s+([0-9a-f]{40,64})/.exec(line.trim())
      if (!match) continue
      const [, original, replacement] = match
      // The original is behind the replacement now, so ask for it with
      // replacements switched off — otherwise both sides read the same.
      const subject = async (sha: string, raw: boolean): Promise<string> =>
        (
          await runGit(repoPath, [...(raw ? ['--no-replace-objects'] : []), 'log', '-1', '--format=%s', sha]).catch(
            () => ''
          )
        ).trim()
      const parents = (
        await runGit(repoPath, ['--no-replace-objects', 'log', '-1', '--format=%P', replacement]).catch(() => '')
      )
        .trim()
        .split(/\s+/)
        .filter(Boolean)
      refs.push({
        original,
        originalSubject: await subject(original, true),
        replacement,
        replacementSubject: await subject(replacement, false),
        replacementParents: parents
      })
    }
    const useReplace = (await runGit(repoPath, ['config', '--get', 'core.useReplaceRefs']).catch(() => '')).trim()
    return { refs, enabled: useReplace !== 'false' }
  },

  /**
   * Graft a commit onto different parents — or onto none at all.
   *
   * `git replace --graft <commit>` with no parents makes that commit look like
   * the beginning of history: everything before it becomes unreachable through
   * normal walks, without a single object being rewritten. Point it at a commit
   * in an archive repository instead, and the truncated clone gets its full
   * history back.
   */
  async replaceGraft(repoPath: string, commit: string, parents: string[]): Promise<string> {
    const target = commit.trim()
    if (!target) throw new Error('Choose a commit to graft.')
    const args = ['replace', '--graft', target, ...parents.map((p) => p.trim()).filter(Boolean)]
    await runGit(repoPath, args)
    return (await runGit(repoPath, ['rev-parse', target])).trim()
  },

  /** Replace one object with another outright. */
  async replaceObject(repoPath: string, original: string, replacement: string): Promise<void> {
    if (!original.trim() || !replacement.trim()) throw new Error('Both objects are needed.')
    await runGit(repoPath, ['replace', '-f', original.trim(), replacement.trim()])
  },

  /** Drop a replacement. The original was never touched, so this restores it. */
  async replaceDelete(repoPath: string, original: string): Promise<void> {
    if (!original.trim()) throw new Error('Nothing to delete.')
    await runGit(repoPath, ['replace', '-d', original.trim()])
  },

  /** Turn replacements on or off for this repository (`core.useReplaceRefs`). */
  async setUseReplaceRefs(repoPath: string, enabled: boolean): Promise<void> {
    if (enabled) await runGit(repoPath, ['config', '--local', '--unset', 'core.useReplaceRefs']).catch(() => undefined)
    else await runGit(repoPath, ['config', '--local', 'core.useReplaceRefs', 'false'])
  },

  // ─── Credential helpers ────────────────────────────────────────────────────
  // Git has its own credential store, and it is neither Gitcito's keychain nor
  // your SSH agent. Misconfiguring it is the usual reason a push asks for a
  // password every single time — or, worse, the reason a password is sitting in
  // a plain file. Nothing here ever reads a secret: `git credential fill` would
  // print one to stdout, so it is not used at all.

  /** How git will answer the next password prompt, and what it would use. */
  async credentialStatus(repoPath: string): Promise<CredentialStatus> {
    const readScope = async (scope: 'system' | 'global' | 'repo'): Promise<string[]> => {
      const flag = scope === 'repo' ? '--local' : `--${scope}`
      const out = await runGit(repoPath, ['config', flag, '--get-all', 'credential.helper']).catch(() => '')
      return out.split('\n').map((l) => l.trim()).filter(Boolean)
    }

    const helpers: CredentialHelperInfo[] = []
    for (const scope of ['system', 'global', 'repo'] as const) {
      for (const value of await readScope(scope)) {
        helpers.push({
          value,
          scope,
          available: credentialHelperExists(value),
          plaintext: value === 'store' || value.startsWith('store ')
        })
      }
    }

    // Per-URL sections: `credential.https://github.com.helper`. These beat the
    // plain setting for the URLs they match, which is exactly the kind of thing
    // that is invisible until it bites.
    const urlRules: CredentialUrlRule[] = []
    for (const scope of ['system', 'global', 'repo'] as const) {
      const flag = scope === 'repo' ? '--local' : `--${scope}`
      const out = await runGit(repoPath, ['config', flag, '--get-regexp', '^credential\\..*\\.(helper|username)$']).catch(
        () => ''
      )
      for (const line of out.split('\n')) {
        const space = line.indexOf(' ')
        if (space < 0) continue
        const match = /^credential\.(.*)\.(helper|username)$/.exec(line.slice(0, space))
        if (!match) continue
        const [, url, key] = match
        const value = line.slice(space + 1).trim()
        const existing = urlRules.find((r) => r.url === url && r.scope === scope)
        const rule = existing ?? { url, helper: '', username: '', scope }
        if (key === 'helper') rule.helper = value
        else rule.username = value
        if (!existing) urlRules.push(rule)
      }
    }

    const plaintextPath = join(homedir(), '.git-credentials')
    const plaintext = await readFile(plaintextPath, 'utf-8').catch(() => null)

    const remotes = await runGit(repoPath, ['remote', '-v']).catch(() => '')
    const hosts = new Set<string>()
    for (const line of remotes.split('\n')) {
      const url = line.split(/\s+/)[1] ?? ''
      // Through the shared reader, whose ambiguous cases are redacted greedily:
      // a first-`@` match would hand `token@host` to the renderer.
      const host = /^https?:\/\/(?:[^/?#\\]*@)?([^/?#\\@]+)/.exec(readUrlUserinfo(url).ambiguous ? '' : urlWithoutPassword(url))?.[1]
      if (host) hosts.add(host)
    }

    return {
      helpers,
      urlRules,
      candidates: credentialCandidates(),
      plaintextFile: {
        path: plaintextPath,
        exists: plaintext !== null,
        // Counted, never returned: every line of that file is a live password.
        entries: plaintext ? plaintext.split('\n').filter((l) => l.trim()).length : 0
      },
      httpsHosts: [...hosts]
    }
  },

  /** Set or clear `credential.helper`. An empty value removes the setting. */
  async setCredentialHelper(repoPath: string, value: string, scope: 'global' | 'repo'): Promise<void> {
    const flag = scope === 'repo' ? '--local' : '--global'
    // `--unset-all`, not `--unset`: helpers stack, and leaving one behind is how
    // "I turned it off and it still remembers" happens.
    await runGit(repoPath, ['config', flag, '--unset-all', 'credential.helper']).catch(() => undefined)
    if (value.trim()) await runGit(repoPath, ['config', flag, '--add', 'credential.helper', value.trim()])
  },

  /**
   * Make git forget what it has stored for a host.
   *
   * `git credential reject` is the documented way in: it hands the request to
   * whichever helper is configured and asks it to erase. Nothing is read back,
   * so no secret passes through here.
   */
  async forgetCredential(repoPath: string, host: string, protocol = 'https'): Promise<void> {
    const target = host.trim()
    if (!target) throw new Error('Give a host to forget.')
    await new Promise<void>((resolve, reject) => {
      const child = spawn('git', ['-C', repoPath, 'credential', 'reject'], { env: noPromptEnv() })
      let err = ''
      child.stderr.on('data', (d: Buffer) => (err += d.toString()))
      child.on('error', reject)
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `git credential reject exited ${code}`))))
      child.stdin.on('error', () => undefined) // command may exit without reading stdin
      child.stdin.end(`protocol=${protocol}\nhost=${target}\n\n`)
    })
  },

  // ─── Attributes ────────────────────────────────────────────────────────────
  // `.gitattributes` is how a repository teaches git about its own files —
  // which are binary, which should concatenate on merge, which never leave the
  // repo in an archive. It travels with the clone, so one person fixing it
  // fixes it for everyone.

  /** Every `.gitattributes` in the repository, plus the private local one. */
  async attributeFiles(repoPath: string): Promise<AttributeFile[]> {
    const tracked = await runGit(repoPath, ['ls-files', '-z', '--', '.gitattributes', '**/.gitattributes']).catch(
      () => ''
    )
    const paths = new Set(tracked.split('\0').filter(Boolean))
    // An untracked root file is the common case right after someone creates one.
    if (existsSync(join(repoPath, '.gitattributes'))) paths.add('.gitattributes')

    const files: AttributeFile[] = []
    for (const path of [...paths].sort()) {
      files.push({ path, content: await readFile(join(repoPath, path), 'utf-8').catch(() => ''), local: false })
    }
    const gitDir = resolvePath(repoPath, (await runGit(repoPath, ['rev-parse', '--git-dir']).catch(() => '.git')).trim())
    const infoPath = join(gitDir, 'info', 'attributes')
    if (existsSync(infoPath)) {
      files.push({
        path: '.git/info/attributes',
        content: await readFile(infoPath, 'utf-8').catch(() => ''),
        local: true
      })
    }
    return files
  },

  /**
   * Write one attributes file whole.
   *
   * The editing is done in the renderer against the file's text, so comments
   * and ordering survive; this only has to refuse to write anywhere else.
   */
  async attributeWrite(repoPath: string, path: string, content: string): Promise<void> {
    const gitDir = resolvePath(repoPath, (await runGit(repoPath, ['rev-parse', '--git-dir']).catch(() => '.git')).trim())
    const target = path === '.git/info/attributes' ? join(gitDir, 'info', 'attributes') : resolvePath(repoPath, path)
    const root = resolvePath(repoPath)
    if (basename(target) !== '.gitattributes' && basename(target) !== 'attributes') {
      throw new Error(`Not an attributes file: ${path}`)
    }
    if (!target.startsWith(root + sep) && !target.startsWith(gitDir + sep)) {
      throw new Error(`Refusing to write outside the repository: ${path}`)
    }
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content, 'utf-8')
  },

  /** What git says applies to these paths — the answer no hand-reading gives. */
  async checkAttributes(repoPath: string, paths: string[]): Promise<AttributeCheck[]> {
    const wanted = paths.map((p) => p.trim()).filter(Boolean)
    if (!wanted.length) return []
    // `-a` asks for every attribute git knows about for the path, `-z` keeps
    // paths with spaces intact: <path>\0<attr>\0<value>\0…
    const out = await runGit(repoPath, ['check-attr', '-a', '-z', '--', ...wanted]).catch(() => '')
    const fields = out.split('\0')
    const byPath = new Map<string, Record<string, string>>(wanted.map((p) => [p, {}]))
    for (let i = 0; i + 2 < fields.length; i += 3) {
      const [path, attr, value] = [fields[i], fields[i + 1], fields[i + 2]]
      if (!path) continue
      const entry = byPath.get(path) ?? {}
      entry[attr] = value
      byPath.set(path, entry)
    }
    return wanted.map((path) => ({ path, attrs: byPath.get(path) ?? {} }))
  },

  /** Diff drivers configured here, and whether their converter is installed. */
  async diffDrivers(repoPath: string): Promise<DiffDriverInfo[]> {
    const read = async (scope: 'repo' | 'global'): Promise<DiffDriverInfo[]> => {
      const args = ['config', ...(scope === 'global' ? ['--global'] : ['--local']), '--get-regexp', '^diff\\..*\\.textconv']
      const out = await runGit(repoPath, args).catch(() => '')
      return out
        .split('\n')
        .map((line) => {
          const space = line.indexOf(' ')
          if (space < 0) return null
          const name = /^diff\.(.*)\.textconv$/.exec(line.slice(0, space))?.[1]
          const textconv = line.slice(space + 1).trim()
          if (!name || !textconv) return null
          // A converter inside an AppImage mount is reported however it looks:
          // that path is gone (or someone else's) the moment the app quits.
          const info: DiffDriverInfo = { name, textconv, available: converterAvailable(textconv), scope }
          if (isEphemeralTextconv(textconv, process.env, process.resourcesPath ?? '')) info.ephemeral = true
          // Left by 4.38 and not repointed (an AppImage, or a config we could
          // not write): fails every diff outside an in-place update.
          else if (isStaleTextconv(textconv)) info.stale = true
          return info
        })
        .filter((d): d is DiffDriverInfo => !!d)
    }
    return [...(await read('repo')), ...(await read('global'))]
  },

  /** Converters Gitcito can wire up for the formats it already previews. */
  // Takes the repo path it will never use: every repo-scoped method does, and
  // the dispatcher locks on it.
  async diffDriverSuggestions(_repoPath: string): Promise<DiffDriverSuggestion[]> {
    // Word, Excel and JSON ride the converter Gitcito ships (resources/cli/
    // githuttbr-textconv), so they work with nothing installed. The rest still
    // need a real tool on PATH, and the UI says plainly which are missing
    // rather than writing a driver that fails at the first diff.
    const shim = bundledTextconvPath()
    const shimConv = `"${shim}"`
    // An AppImage's shim lives in a per-launch /tmp mount, so writing its path
    // into .git/config would leave the next `git diff` running whatever another
    // local user puts there after we quit. Offered, but disabled, with the reason.
    const blocked = persistBlocker(shim, process.resourcesPath ?? '')
    const shimOk = !blocked && canExecute(shim)
    const shimWhy = blocked ? { unavailableReason: blocked } : {}
    const candidates: DiffDriverSuggestion[] = [
      { name: 'word', patterns: ['*.docx'], textconv: shimConv, binary: '', bundled: true, available: shimOk, ...shimWhy },
      { name: 'excel', patterns: ['*.xlsx', '*.xls'], textconv: shimConv, binary: '', bundled: true, available: shimOk, ...shimWhy },
      { name: 'json', patterns: ['*.json', '*.xcstrings'], textconv: shimConv, binary: '', bundled: true, available: shimOk, ...shimWhy },
      // Git calls a UTF-16 .strings binary and shows no diff at all, which is
      // the one file where seeing which string moved matters most.
      { name: 'strings', patterns: ['*.strings'], textconv: shimConv, binary: '', bundled: true, available: shimOk, ...shimWhy },
      { name: 'pdf', patterns: ['*.pdf'], textconv: 'pdftotext -layout - -', binary: 'pdftotext', available: hasBinary('pdftotext') },
      { name: 'exif', patterns: ['*.jpg', '*.jpeg', '*.png'], textconv: 'exiftool', binary: 'exiftool', available: hasBinary('exiftool') }
    ]
    return candidates
  },

  /**
   * Point this repository's pre-4.39 converter entries at the one this install
   * ships, and report them along with the global ones start-up rewrote (those
   * only once per run, to whichever repository asks first). A write: it takes
   * the exclusive lock, so it never interleaves with a setDiffDriver.
   */
  async repointLegacyDiffDrivers(repoPath: string): Promise<DiffDriverRepoint[]> {
    const global = await repointGlobalLegacyTextconvs()
    const reportGlobal = !globalRepointReported && global.length > 0
    if (reportGlobal) globalRepointReported = true
    const local = await repointLegacyTextconvs(repoPath, 'repo')
    return [...local, ...(reportGlobal ? global : [])]
  },

  /** Set (or clear) `diff.<name>.textconv`. */
  async setDiffDriver(repoPath: string, name: string, textconv: string, global = false): Promise<void> {
    const scope = global ? ['--global'] : ['--local']
    const key = `diff.${name}.textconv`
    // The UI never offers it, but the IPC is reachable: refuse the path here too
    // — anywhere on the line, and under this AppImage's resources root as well.
    if (textconv.trim() && isEphemeralTextconv(textconv, process.env, process.resourcesPath ?? '')) {
      throw new Error('Refusing to configure a converter inside a temporary AppImage mount')
    }
    if (textconv.trim()) await runGit(repoPath, ['config', ...scope, key, textconv.trim()])
    else await runGit(repoPath, ['config', ...scope, '--unset', key]).catch(() => undefined)
  },

  // ─── Clean/smudge filters ──────────────────────────────────────────────────
  // A filter runs on every checkout of every matching file, and a wrong one
  // corrupts a working tree quietly. So configuring one here is gated on a dry
  // run against real repository files, and setFilterDriver returns what it
  // overwrote so the store can hang an undo entry on it.

  /** Configured `filter.<name>.clean/smudge` drivers, local and global. */
  async filterDrivers(repoPath: string): Promise<FilterDriverInfo[]> {
    const read = async (scope: 'repo' | 'global'): Promise<FilterDriverInfo[]> => {
      const args = [
        'config',
        ...(scope === 'global' ? ['--global'] : ['--local']),
        '--get-regexp',
        '^filter\\..*\\.(clean|smudge|required)$'
      ]
      const out = await runGit(repoPath, args).catch(() => '')
      const byName = new Map<string, FilterDriverInfo>()
      for (const line of out.split('\n')) {
        const space = line.indexOf(' ')
        if (space < 0) continue
        const m = /^filter\.(.+)\.(clean|smudge|required)$/.exec(line.slice(0, space))
        if (!m) continue
        const value = line.slice(space + 1).trim()
        const info =
          byName.get(m[1]) ??
          ({ name: m[1], clean: '', smudge: '', required: false, scope, cleanAvailable: true, smudgeAvailable: true } as FilterDriverInfo)
        if (m[2] === 'clean') {
          info.clean = value
          info.cleanAvailable = converterAvailable(value)
        } else if (m[2] === 'smudge') {
          info.smudge = value
          info.smudgeAvailable = converterAvailable(value)
        } else {
          info.required = value === 'true'
        }
        byName.set(m[1], info)
      }
      return [...byName.values()]
    }
    return [...(await read('repo')), ...(await read('global'))]
  },

  /**
   * Try a clean/smudge pair against real matching files WITHOUT configuring
   * anything: run `clean` on a copy of each file's bytes, then `smudge` on the
   * result, and report whether the roundtrip reproduces the original. Nothing
   * in the repository or its config is touched.
   */
  async filterDryRun(repoPath: string, pattern: string, clean: string, smudge: string): Promise<FilterDryRunResult> {
    const listed = await runGit(repoPath, ['ls-files', '-z', '--', pattern]).catch(() => '')
    const matches = listed.split('\0').filter(Boolean)
    const tested: FilterDryRunFile[] = []
    for (const file of matches.slice(0, FILTER_DRY_RUN_FILES)) {
      try {
        const original = await readFile(join(repoPath, file))
        if (original.byteLength > FILTER_DRY_RUN_MAX_BYTES) {
          tested.push({ file, ok: false, error: 'file too large for a dry run', roundtrip: 'skipped', preview: '' })
          continue
        }
        const cleaned = await runFilterCommand(clean, repoPath, file, original)
        let roundtrip: FilterDryRunFile['roundtrip'] = 'skipped'
        if (smudge.trim()) {
          const smudged = await runFilterCommand(smudge, repoPath, file, cleaned)
          roundtrip = smudged.equals(original) ? 'ok' : 'different'
        }
        tested.push({
          file,
          ok: true,
          roundtrip,
          preview: cleaned.subarray(0, FILTER_PREVIEW_BYTES).toString('utf-8')
        })
      } catch (err) {
        tested.push({
          file,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          roundtrip: 'skipped',
          preview: ''
        })
      }
    }
    return { matched: matches.length, tested }
  },

  /**
   * Write (or clear, when both commands are empty) a `filter.<name>` driver.
   * Returns the values that were there before, for the undo entry.
   */
  async setFilterDriver(
    repoPath: string,
    name: string,
    driver: { clean: string; smudge: string; required: boolean },
    global = false
  ): Promise<FilterDriverPrevious> {
    const scope = global ? ['--global'] : ['--local']
    const get = (key: string): Promise<string> =>
      runGit(repoPath, ['config', ...scope, '--get', key]).then((v) => v.trim()).catch(() => '')
    const previous: FilterDriverPrevious = {
      clean: await get(`filter.${name}.clean`),
      smudge: await get(`filter.${name}.smudge`),
      required: (await get(`filter.${name}.required`)) === 'true'
    }
    const set = async (key: string, value: string): Promise<void> => {
      if (value) await runGit(repoPath, ['config', ...scope, key, value])
      else await runGit(repoPath, ['config', ...scope, '--unset', key]).catch(() => undefined)
    }
    await set(`filter.${name}.clean`, driver.clean.trim())
    await set(`filter.${name}.smudge`, driver.smudge.trim())
    await set(`filter.${name}.required`, driver.required && (driver.clean.trim() || driver.smudge.trim()) ? 'true' : '')
    return previous
  },

  // ─── Object explorer ───────────────────────────────────────────────────────
  // Everything git does is four object types and some refs pointing at them.
  // These two reads expose that layer as it actually is — no porcelain, no
  // interpretation, and nothing that can change a byte.

  /** Every ref in the repository, plus HEAD, with what it points at. */
  async objectRefs(repoPath: string): Promise<RefObject[]> {
    const out = await runGit(repoPath, [
      'for-each-ref',
      `--format=%(refname)${SEP}%(objectname)${SEP}%(objecttype)`
    ]).catch(() => '')
    const refs: RefObject[] = []
    for (const line of out.split('\n')) {
      const [name, sha, kind] = line.split(SEP)
      if (name && sha) refs.push({ name, sha, kind: (kind as GitObjectKind) ?? 'commit' })
    }
    // HEAD is a ref too, and the one people start from — for-each-ref omits it.
    const head = (await runGit(repoPath, ['rev-parse', 'HEAD']).catch(() => '')).trim()
    if (head) refs.unshift({ name: 'HEAD', sha: head, kind: 'commit' })
    return refs
  },

  /**
   * Resolve any revision expression to the object it names, decoded.
   *
   * `rev` is whatever `git rev-parse` accepts: a sha, `HEAD~3`, `main^{tree}`,
   * `v1.0^{}`, or `HEAD:src/app.ts`. Being able to type those is half the point
   * — the explorer is a way to learn the model, not just to browse it.
   */
  async gitObject(repoPath: string, rev: string): Promise<GitObject> {
    const wanted = rev.trim() || 'HEAD'
    const sha = (await runGit(repoPath, ['rev-parse', '--verify', `${wanted}`])).trim()
    const kind = (await runGit(repoPath, ['cat-file', '-t', sha])).trim() as GitObjectKind
    const size = Number((await runGit(repoPath, ['cat-file', '-s', sha]).catch(() => '0')).trim()) || 0
    const object: GitObject = { sha, kind, size, rev: wanted }

    if (kind === 'tree') {
      const listing = await runGit(repoPath, ['ls-tree', '-l', '-z', sha]).catch(() => '')
      object.tree = listing
        .split('\0')
        .filter(Boolean)
        .map((entry) => {
          // "<mode> <type> <sha> <size>\t<name>" — size is '-' for trees.
          const [meta, name = ''] = entry.split('\t')
          const [mode, type, childSha, rawSize] = meta.trim().split(/\s+/)
          return {
            mode,
            kind: type as GitObjectKind,
            sha: childSha,
            name,
            size: rawSize && rawSize !== '-' ? Number(rawSize) : null
          }
        })
      return object
    }

    const body = await runGit(repoPath, ['cat-file', '-p', sha]).catch(() => '')

    if (kind === 'commit') {
      const header = body.split('\n\n')[0] ?? ''
      const field = (key: string): string => new RegExp(`^${key} (.*)$`, 'm').exec(header)?.[1]?.trim() ?? ''
      object.commit = {
        tree: field('tree'),
        parents: [...header.matchAll(/^parent (.*)$/gm)].map((m) => m[1].trim()),
        author: field('author'),
        committer: field('committer'),
        message: body.slice(header.length).replace(/^\n+/, '')
      }
      return object
    }

    if (kind === 'tag') {
      const header = body.split('\n\n')[0] ?? ''
      const field = (key: string): string => new RegExp(`^${key} (.*)$`, 'm').exec(header)?.[1]?.trim() ?? ''
      object.tag = {
        object: field('object'),
        type: field('type'),
        name: field('tag'),
        tagger: field('tagger'),
        message: body.slice(header.length).replace(/^\n+/, '')
      }
      return object
    }

    // A blob: show the head of it, and say plainly when it is not text rather
    // than spraying control characters into the pane.
    const raw = await pexecFile('git', ['-C', repoPath, 'cat-file', '-p', sha], {
      env: noPromptEnv(),
      encoding: 'buffer',
      maxBuffer: 16 * 1024 * 1024
    }).catch(() => ({ stdout: Buffer.alloc(0) }))
    const buffer = raw.stdout as Buffer
    const head = buffer.subarray(0, OBJECT_BLOB_PREVIEW)
    const binary = head.includes(0)
    object.blob = {
      text: binary ? null : head.toString('utf-8'),
      truncated: buffer.length > head.length
    }
    return object
  },

  // ─── Repository maintenance ────────────────────────────────────────────────
  // git keeps working whatever state its object database is in, which is why
  // nobody ever runs gc until a clone takes ten minutes. These read the numbers
  // that would otherwise stay invisible, and run the jobs that act on them.

  /** Where the disk went, and how much of it maintenance could get back. */
  async maintenanceStats(repoPath: string): Promise<MaintenanceStats> {
    const counts = await runGit(repoPath, ['count-objects', '-v']).catch(() => '')
    const num = (key: string): number => Number(new RegExp(`^${key}: (\\d+)$`, 'm').exec(counts)?.[1] ?? 0)

    const gitDir = resolvePath(repoPath, (await runGit(repoPath, ['rev-parse', '--git-dir']).catch(() => '.git')).trim())

    // `prune -n` is a full reachability walk: the honest number, and the slow
    // one. It is also the only way to say what "unreachable" costs here. Only
    // loose objects are listed, which is exactly what prune removes — so each
    // one is a file to stat rather than an object to ask git about.
    const prunable = await runGit(repoPath, ['prune', '-n', '--expire=now']).catch(() => '')
    const shas = prunable
      .split('\n')
      .map((line) => /^([0-9a-f]{40,64})\b/.exec(line.trim())?.[1])
      .filter((sha): sha is string => !!sha)
    let prunableBytes = 0
    for (const sha of shas) {
      prunableBytes += await stat(join(gitDir, 'objects', sha.slice(0, 2), sha.slice(2)))
        .then(diskBytes)
        .catch(() => 0)
    }
    const gitBytes = await dirBytes(gitDir, { files: 200_000 })

    // The newest packfile's mtime is when gc last did something worth doing.
    let lastPack: string | null = null
    const packDir = join(gitDir, 'objects', 'pack')
    for (const name of await readdir(packDir).catch(() => [] as string[])) {
      if (!name.endsWith('.pack')) continue
      const when = await stat(join(packDir, name)).then((s) => s.mtime.toISOString()).catch(() => null)
      if (when && (!lastPack || when > lastPack)) lastPack = when
    }

    const registered = await runGit(repoPath, ['config', '--global', '--get-all', 'maintenance.repo']).catch(() => '')
    const real = resolvePath(repoPath)

    return {
      looseObjects: num('count'),
      looseBytes: num('size') * 1024,
      packedObjects: num('in-pack'),
      packs: num('packs'),
      packBytes: num('size-pack') * 1024,
      prunePackable: num('prune-packable'),
      garbageFiles: num('garbage'),
      garbageBytes: num('size-garbage') * 1024,
      prunable: shas.length,
      prunableBytes,
      gitBytes,
      lastPack,
      scheduled: registered.split('\n').some((line) => resolvePath(line.trim() || '.') === real),
      gcLog: await readFile(join(gitDir, 'gc.log'), 'utf-8').catch(() => '')
    }
  },

  /**
   * Run one maintenance job, reporting the size on either side of it.
   *
   * `prune` is the only one that destroys anything: gc keeps unreachable objects
   * for two weeks precisely so a bad reset stays recoverable, and pruning now
   * throws that safety net away.
   */
  async maintenanceRun(repoPath: string, task: MaintenanceTask): Promise<MaintenanceResult> {
    const gitDir = resolvePath(repoPath, (await runGit(repoPath, ['rev-parse', '--git-dir']).catch(() => '.git')).trim())
    const before = await dirBytes(gitDir, { files: 200_000 })
    const args: Record<MaintenanceTask, string[]> = {
      gc: ['gc'],
      aggressive: ['gc', '--aggressive'],
      commitGraph: ['commit-graph', 'write', '--reachable'],
      prune: ['gc', '--prune=now']
    }
    const output = await runGit(repoPath, args[task])
    return { before, after: await dirBytes(gitDir, { files: 200_000 }), output: output.trim() }
  },

  /** Register or unregister this repository with `git maintenance`. */
  async maintenanceSchedule(repoPath: string, on: boolean): Promise<boolean> {
    // `start` writes the OS schedule (launchd / systemd / Task Scheduler) as
    // well as registering; `unregister` leaves the schedule alone for the other
    // repositories still in it.
    await runGit(repoPath, ['maintenance', on ? 'start' : 'unregister'])
    return on
  },

  /** Check the object database. Dangling is normal; missing is damage. */
  async fsck(repoPath: string): Promise<FsckReport> {
    let output = ''
    let ok = true
    try {
      const { stdout, stderr } = await pexecFile(
        'git',
        ['-C', repoPath, 'fsck', '--no-progress', '--dangling'],
        { env: noPromptEnv(), maxBuffer: 16 * 1024 * 1024 }
      )
      output = `${stdout}${stderr}`
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string }
      ok = false
      output = `${e.stdout ?? ''}${e.stderr || e.message || ''}`
    }
    const lines = output.split('\n')
    return {
      ok,
      dangling: lines.filter((l) => l.startsWith('dangling ')).length,
      missing: lines.filter((l) => /^missing |^broken link/.test(l)).length,
      output: output.trim().slice(0, 20_000)
    }
  },

  // ─── Bundles and archives ──────────────────────────────────────────────────
  // Two ways to put a repository into a single file. A bundle is git history —
  // it clones and fetches like a remote, and is how work crosses an air gap. An
  // archive is just the files at one commit, with no history at all.

  /** Write a bundle of `scope` to `file`, and report what it ended up holding. */
  async bundleCreate(repoPath: string, file: string, scope: BundleScope): Promise<BundleResult> {
    const args = ['bundle', 'create', file]
    if (scope.kind === 'all') args.push('--all')
    else if (scope.kind === 'ref') args.push(scope.ref)
    // A range bundle records the far end as a prerequisite: it is a patch of
    // history, useless to anyone who does not already have `from`.
    else args.push(`${scope.from}..${scope.to}`)
    await runGit(repoPath, args)

    const heads = await runGit(repoPath, ['bundle', 'list-heads', file]).catch(() => '')
    return {
      path: file,
      bytes: await stat(file).then((s) => s.size).catch(() => 0),
      refs: heads.split('\n').filter((l) => l.trim()).length
    }
  },

  /** What a bundle holds, and whether this repository has what it needs to use it. */
  async bundleInspect(repoPath: string, file: string): Promise<BundleInfo> {
    const heads = await runGit(repoPath, ['bundle', 'list-heads', file]).catch(() => '')
    const refs: BundleRef[] = []
    for (const line of heads.split('\n')) {
      const [sha, ...rest] = line.trim().split(/\s+/)
      if (/^[0-9a-f]{7,}$/.test(sha) && rest.length) refs.push({ sha, name: rest.join(' ') })
    }

    // `git bundle verify` says everything useful on stderr and exits non-zero
    // when a prerequisite is missing — which is a fact to report, not a failure.
    let ok = true
    let output = ''
    try {
      const { stdout, stderr } = await pexecFile('git', ['-C', repoPath, 'bundle', 'verify', file], {
        env: noPromptEnv()
      })
      output = `${stdout}${stderr}`
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string }
      ok = false
      output = `${e.stdout ?? ''}${e.stderr || e.message || ''}`
    }
    // verify prints shas twice over — the refs the bundle *contains*, and the
    // ones it *requires* — so the prerequisites are only the shas under the
    // requires heading (or, when git could not read them, its `error:` lines).
    const prerequisites: string[] = []
    let inRequires = false
    for (const raw of output.split('\n')) {
      const line = raw.trim().replace(/^error:\s*/, '')
      if (/requires (this|these).*ref|lacks these prerequisite/i.test(line)) {
        inRequires = true
        continue
      }
      const m = /^([0-9a-f]{40,64})\b/.exec(line)
      if (m) {
        if (inRequires) prerequisites.push(m[1])
      } else if (line) {
        inRequires = false
      }
    }
    return { refs, prerequisites, usable: ok, message: output.trim() }
  },

  /**
   * Fetch refs out of a bundle into `refs/remotes/bundle/*`.
   *
   * Deliberately not onto the local branches: a bundle is someone else's work
   * arriving, and landing it on `main` behind the user's back is how you lose
   * commits. Under a remote-shaped namespace it shows up in the branch list and
   * merges (or does not) on their terms.
   */
  async bundleFetch(repoPath: string, file: string, refs: string[]): Promise<string[]> {
    const wanted = refs.filter(Boolean)
    if (!wanted.length) throw new Error('Choose at least one ref to import.')
    const specs = wanted.map((ref) => {
      const short = ref.replace(/^refs\/heads\//, '').replace(/^refs\//, '')
      return `+${ref}:refs/remotes/bundle/${short}`
    })
    assertNotOption(file, 'the bundle path')
    await runGit(repoPath, ['fetch', '--', file, ...specs])
    return wanted.map((ref) => `bundle/${ref.replace(/^refs\/heads\//, '').replace(/^refs\//, '')}`)
  },

  /**
   * Export one tree as a zip or tarball. `git archive` honours `export-ignore`
   * in .gitattributes, so a repository can keep its own CI config and fixtures
   * out of the file it hands to someone else.
   */
  async archiveCreate(
    repoPath: string,
    file: string,
    ref: string,
    format: ArchiveFormat,
    prefix: string,
    subdir: string
  ): Promise<ArchiveResult> {
    const args = ['archive', `--format=${format}`, '-o', file]
    // Without a prefix every path lands at the root of the archive, which turns
    // an unzip in the wrong directory into a mess of loose files.
    if (prefix.trim()) args.push(`--prefix=${prefix.trim().replace(/\/*$/, '/')}`)
    args.push(ref.trim() || 'HEAD')
    if (subdir.trim()) args.push('--', subdir.trim())
    await runGit(repoPath, args)
    return { path: file, bytes: await stat(file).then((s) => s.size).catch(() => 0) }
  },

  // ─── Untracked files (`git clean`) ─────────────────────────────────────────
  // Removing untracked files is the one destructive git operation with no
  // recovery: the content was never in an object, so no reflog, no stash, no
  // undo. Hence a preview that says exactly what would go and how big it is,
  // and a trash option that takes the finality out of it.

  /** What `git clean` would remove, sized, with ignored paths kept apart. */
  async cleanPreview(repoPath: string): Promise<CleanPreview> {
    const { untracked, ignored } = await cleanCandidates(repoPath)
    const all = [
      ...untracked.map((path) => ({ path, ignored: false })),
      ...ignored.map((path) => ({ path, ignored: true }))
    ]
    const kept = all.slice(0, CLEAN_ENTRY_CAP)
    const budget = { files: CLEAN_WALK_CAP }

    const entries: CleanEntry[] = []
    for (const { path, ignored: isIgnored } of kept) {
      const isDir = path.endsWith('/')
      const full = resolvePath(repoPath, path)
      entries.push({
        path,
        kind: isDir ? 'dir' : 'file',
        ignored: isIgnored,
        bytes: isDir
          ? await dirBytes(full, budget)
          : await stat(full).then((s) => s.size).catch(() => 0),
        nested: isDir && existsSync(join(full, '.git'))
      })
    }
    return { entries, truncated: all.length > kept.length }
  },

  /**
   * Remove untracked paths, either to the OS trash or for good.
   *
   * Every path is checked against git's own candidate list first: the trash
   * route does not go through git, so without that check a tracked file could
   * be deleted by passing its name.
   */
  async clean(repoPath: string, paths: string[], trash: boolean): Promise<CleanResult> {
    const targets = paths.filter(Boolean)
    if (!targets.length) throw new Error('Nothing selected to remove.')
    await guardSnapshot(repoPath)

    const { untracked, ignored } = await cleanCandidates(repoPath)
    const removable = new Set([...untracked, ...ignored])
    const root = resolvePath(repoPath)
    for (const path of targets) {
      if (!removable.has(path)) throw new Error(`Not an untracked path in this repository: ${path}`)
      const full = resolvePath(repoPath, path)
      if (full !== root && !full.startsWith(root + sep)) {
        throw new Error(`Refusing to remove outside the repository: ${path}`)
      }
    }

    const budget = { files: CLEAN_WALK_CAP }
    const failed: string[] = []
    let removed = 0
    let bytes = 0
    for (const path of targets) {
      const full = resolvePath(repoPath, path)
      const size = path.endsWith('/')
        ? await dirBytes(full, budget)
        : await stat(full).then((s) => s.size).catch(() => 0)
      try {
        if (trash) await shell.trashItem(full)
        // `-x` so an explicitly chosen ignored path goes too; the pathspec keeps
        // that from meaning "and everything else ignored".
        else await runGit(repoPath, ['clean', '-f', '-d', '-x', '--', path])
        // git skips a directory that is its own repository and still exits 0.
        if (existsSync(full)) throw new Error('git skipped it — a nested repository can only go to the trash')
        removed++
        bytes += size
      } catch (err) {
        failed.push(`${path} — ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    if (failed.length) throw new Error(`Could not remove ${failed.length} of ${targets.length}:\n${failed.join('\n')}`)
    return { removed, bytes, trashed: trash }
  },

  async discard(repoPath: string, files: string[], untracked: boolean): Promise<void> {
    await guardSnapshot(repoPath)
    const git = gitFor(repoPath)
    if (untracked) {
      await git.clean('f', ['--', ...files])
      return
    }
    // Batched, not per-file: each spawned git costs tens of ms, and the old
    // cascade paid up to five per path — a 20-file discard could spend seconds
    // on process spawns alone. Two read-only probes classify every pathspec in
    // one go, then one checkout per class does the work:
    //  - in the index: `checkout --` restores the staged version (the common
    //    case — staged changes are kept, exactly as before).
    //  - only in HEAD (staged deletions/renames): `checkout HEAD --` brings the
    //    file back from the last commit.
    //  - in neither: a staged-new file Discard all just unstaged, or a path git
    //    truly never had — deleted like an untracked file.
    // A batch checkout is all-or-nothing — one odd path (unmerged, vanished
    // mid-op) fails it whole — so a failure replays that class through the
    // per-file cascade, which keeps its exact tolerances for the rare file.
    const inIndex = await probePaths(repoPath, ['ls-files', '-z', '--', ...files])
    const inHead = await probePaths(repoPath, [
      'ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', ...files
    ])
    const fromIndex = files.filter((f) => pathspecMatches(inIndex, f))
    const fromHead = files.filter((f) => !pathspecMatches(inIndex, f) && pathspecMatches(inHead, f))
    const unknown = files.filter((f) => !pathspecMatches(inIndex, f) && !pathspecMatches(inHead, f))
    try {
      if (fromIndex.length) {
        await runGit(repoPath, ['--literal-pathspecs', 'checkout', '--', ...fromIndex])
      }
      if (fromHead.length) {
        await runGit(repoPath, ['--literal-pathspecs', 'checkout', 'HEAD', '--', ...fromHead])
      }
    } catch {
      for (const f of [...fromIndex, ...fromHead]) await discardOne(repoPath, f)
    }
    if (!unknown.length) return
    // Before a filesystem delete, one more batched membership check catches a
    // path git learned between the probes and now — anything git knows is a
    // real failure to report, not a file to wipe by hand.
    const lateIndex = await probePaths(repoPath, ['ls-files', '-z', '--', ...unknown])
    const lateHead = await probePaths(repoPath, [
      'ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', ...unknown
    ])
    for (const f of unknown) {
      if (pathspecMatches(lateIndex, f) || pathspecMatches(lateHead, f)) {
        await discardOne(repoPath, f)
        continue
      }
      const full = await containedPath(repoPath, f)
      if (!full) throw new Error(`Refusing to delete outside the repository: ${f}`)
      await rm(full, { force: true })
    }
  },

  /**
   * Append repo-relative patterns to the repository's root `.gitignore`,
   * skipping any that are already present. Patterns should be supplied
   * pre-formatted (e.g. anchored with a leading `/`, folders with a
   * trailing `/`). Returns the patterns that were actually added.
   */
  async addToGitignore(repoPath: string, patterns: string[]): Promise<string[]> {
    return gitService.addToGitignoreAt(repoPath, '', patterns)
  },

  /**
   * Append patterns to the .gitignore in `dir` (relative to the repo; '' = root).
   * Creates the file if absent, skips entries already present.
   */
  async addToGitignoreAt(repoPath: string, dir: string, patterns: string[]): Promise<string[]> {
    const file = join(repoPath, dir, '.gitignore')
    let current = ''
    try {
      current = await readFile(file, 'utf8')
    } catch {
      current = ''
    }
    const existing = new Set(current.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))
    const toAdd = patterns.map((p) => p.trim()).filter((p) => p && !existing.has(p))
    if (toAdd.length === 0) return []
    const needsNl = current.length > 0 && !current.endsWith('\n')
    const next = current + (needsNl ? '\n' : '') + toAdd.join('\n') + '\n'
    await mkdir(join(repoPath, dir), { recursive: true }).catch(() => {})
    await writeFile(file, next, 'utf8')
    return toAdd
  },

  /**
   * Stop tracking files/folders. By default they are removed from the index
   * only (kept on disk); when `deleteFromDisk` is true they are also removed
   * from the working tree. `-r` allows folders; `--ignore-unmatch` keeps the
   * call safe if a path was already untracked.
   */
  async untrack(repoPath: string, files: string[], deleteFromDisk = false): Promise<void> {
    if (files.length === 0) return
    const args = ['rm', '-r', '--ignore-unmatch']
    if (!deleteFromDisk) args.push('--cached')
    await gitFor(repoPath).raw([...args, '--', ...files])
  },

  // ─── Project tree (working-directory file explorer) ──────────────────────

  /**
   * Immediate children of `relDir` (repo-relative POSIX path; '' = root).
   * The `.git` directory is hidden. Sorted folders-first, then by name.
   * Lazy per-directory listing keeps huge trees (node_modules) responsive.
   */
  async listDir(repoPath: string, relDir = ''): Promise<TreeEntry[]> {
    const abs = join(repoPath, relDir)
    // A folder can vanish or become unreadable between listing and a re-read
    // (e.g. a tool regenerates .husky/_, a watcher refresh races a delete).
    // Treat that as an empty folder rather than surfacing a scary ENOENT.
    const ents = await readdir(abs, { withFileTypes: true }).catch(() => [])
    const out: TreeEntry[] = []
    for (const e of ents) {
      if (relDir === '' && e.name === '.git') continue
      const dir = e.isDirectory()
      const path = relDir ? `${relDir}/${e.name}` : e.name
      out.push({ name: e.name, path, dir })
    }
    out.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
    return out
  },

  /**
   * The same listing, but for a repo as it was at `ref` — read straight from the
   * object database (`git ls-tree`), so the Time Machine can walk any past
   * commit's tree without checking anything out or touching the working copy.
   */
  async listDirAt(repoPath: string, ref: string, relDir = ''): Promise<TreeEntry[]> {
    // The trailing slash keeps ls-tree listing *inside* the directory rather
    // than returning the directory entry itself.
    const spec = relDir ? `${ref}:${relDir}` : `${ref}:`
    const raw = await gitFor(repoPath)
      .raw(['ls-tree', '-z', '--full-name', spec])
      .catch((err: unknown) => {
        // A path (or ref) that simply isn't in that tree is an ordinary answer:
        // the folder didn't exist yet at this point in history. Anything else
        // is a real failure and must reach the caller instead of quietly
        // rendering as an empty directory.
        const message = err instanceof Error ? err.message : String(err)
        if (/not a valid object name|does not exist|exists on disk, but not in/i.test(message)) return ''
        throw err
      })
    const out: TreeEntry[] = []
    for (const record of raw.split('\0').filter(Boolean)) {
      // `<mode> <type> <oid>\t<path>`
      const tab = record.indexOf('\t')
      if (tab < 0) continue
      const type = record.slice(0, tab).split(/\s+/)[1]
      // ls-tree names are relative to the rev's prefix (`HEAD:src`), so the
      // repo-relative path has to be rebuilt from the directory we asked for.
      const name = record.slice(tab + 1)
      const path = relDir ? `${relDir}/${name}` : name
      // Submodules (`commit` entries) have no tree to descend into here.
      out.push({ name, path, dir: type === 'tree' })
    }
    out.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
    return out
  },

  /**
   * Flat list of every searchable file path (repo-relative POSIX): tracked plus
   * untracked-but-not-ignored, the same scope VSCode searches by default. Fast —
   * `ls-files` skips node_modules/etc via the ignore rules, no fs walk.
   */
  async listFiles(repoPath: string): Promise<string[]> {
    const raw = await gitFor(repoPath)
      .raw(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
      .catch(() => '')
    // De-dupe (a path can appear in both cached + others briefly during edits).
    return Array.from(new Set(raw.split('\0').filter(Boolean)))
  },

  /**
   * Per-repo protected branches, stored in git config (githuttbr.protectedbranches,
   * comma-joined) so they travel with the repo. Unset → default main/master.
   * Upstream's gitcito.protectedbranches is read when the new key is absent.
   */
  async protectedBranches(repoPath: string): Promise<string[]> {
    // `runGit`, not simple-git: `config --get` exits 1 for a key that is not
    // there, and simple-git hands that back as an empty string rather than an
    // error — which quietly turned "never configured" into "nothing is
    // protected", and took the force-push guard on main with it.
    let raw: string | null = null
    for (const ns of APP_IDS) {
      raw = await runGit(repoPath, ['config', '--get', `${ns}.protectedbranches`]).catch(() => null)
      if (raw !== null) break
    }
    if (raw === null) return ['main', 'master'] // never configured → sensible default
    return raw
      .trim()
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean)
  },

  async setProtectedBranches(repoPath: string, branches: string[]): Promise<void> {
    const value = branches.map((b) => b.trim()).filter(Boolean).join(',')
    await gitFor(repoPath).raw(['config', `${APP_ID}.protectedbranches`, value])
  },

  // ─── .githuttbr.json ─────────────────────────────────────────────────────
  // The repository's own house rules, committed alongside the code. Thin
  // delegates: the reasoning, the validation and the safety rules all live in
  // main/repoConfig.ts, next to shared/repoConfig.ts which the editor shares.

  async repoConfig(repoPath: string): Promise<RepoConfigResult> {
    return readRepoConfig(repoPath)
  },

  async setRepoConfig(repoPath: string, config: RepoConfig): Promise<RepoConfigResult> {
    return writeRepoConfig(repoPath, config)
  },

  async repoDoctor(repoPath: string): Promise<DoctorCheck[]> {
    return runRepoDoctor(repoPath)
  },

  async applyDoctorFix(repoPath: string, fix: DoctorFix): Promise<void> {
    return applyDoctorFixOnDisk(repoPath, fix)
  },

  async suggestRepoConfig(repoPath: string): Promise<RepoConfig> {
    return suggestRepoConfigFromRepo(repoPath)
  },

  // ─── rerere ──────────────────────────────────────────────────────────────
  // "reuse recorded resolution": git memorises how you resolved a conflict and
  // replays it the next time the same one appears. The payoff is a long-lived
  // branch rebased repeatedly through the same collision — you resolve it once.

  async rerereStatus(repoPath: string): Promise<RerereStatus> {
    const git = gitFor(repoPath)
    const read = async (key: string, scope?: string[]): Promise<string> =>
      (await git.raw(['config', ...(scope ?? []), '--get', key]).catch(() => '')).trim()

    const enabled = await read('rerere.enabled')
    const local = await read('rerere.enabled', ['--local'])

    // `.git/rr-cache` holds one directory per memorised conflict.
    const gitDir = (await git.raw(['rev-parse', '--git-dir']).catch(() => '.git')).trim()
    const cache = resolvePath(repoPath, gitDir, 'rr-cache')
    let recorded = 0
    try {
      const { readdirSync } = await import('fs')
      recorded = readdirSync(cache).filter((name) => !name.startsWith('.')).length
    } catch {
      /* no cache yet — nothing memorised */
    }

    // Only what git itself announced during the operation still in progress. A
    // file the *user* resolved without staging also has no markers and is also
    // still unmerged, so content alone cannot tell the two apart.
    const conflicted = new Set(
      (await git.raw(['diff', '--name-only', '--diff-filter=U']).catch(() => ''))
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    )
    if (!conflicted.size) rerereReplayed.delete(repoPath)
    const replayed = (rerereReplayed.get(repoPath) ?? []).filter((file) => conflicted.has(file))

    return {
      enabled: enabled === 'true',
      autoUpdate: (await read('rerere.autoUpdate')) === 'true',
      perRepo: !!local,
      recorded,
      replayed
    }
  },

  /**
   * Turn the memory on or off. Written globally by default — someone who wants
   * git to remember their resolutions wants that everywhere, and it is the same
   * `rerere.enabled` their command line reads.
   */
  async setRerere(
    repoPath: string,
    values: { enabled?: boolean; autoUpdate?: boolean },
    scope: 'global' | 'repo' = 'global'
  ): Promise<void> {
    const where = scope === 'global' ? ['--global'] : ['--local']
    const git = gitFor(repoPath)
    if (values.enabled !== undefined) await git.raw(['config', ...where, 'rerere.enabled', String(values.enabled)])
    if (values.autoUpdate !== undefined) {
      await git.raw(['config', ...where, 'rerere.autoUpdate', String(values.autoUpdate)])
    }
  },

  /**
   * Drop the memorised resolution for one file and bring its conflict back.
   *
   * `git rerere forget` alone only stops the replay happening *next* time — it
   * leaves the already-written file as it is, which is not what someone asking
   * for the conflict back means. `checkout --merge` rebuilds the markers from
   * the index stages, which are still there.
   */
  async rerereForget(repoPath: string, file: string): Promise<void> {
    await runGit(repoPath, ['rerere', 'forget', '--', file])
    await runGit(repoPath, ['checkout', '--merge', '--', file]).catch(() => undefined)
  },

  /** Empty the whole memory. Files and history are untouched. */
  async rerereClear(repoPath: string): Promise<void> {
    const git = gitFor(repoPath)
    const gitDir = (await git.raw(['rev-parse', '--git-dir'])).trim()
    const { rm } = await import('fs/promises')
    await rm(resolvePath(repoPath, gitDir, 'rr-cache'), { recursive: true, force: true })
  },

  // ─── Subtrees ────────────────────────────────────────────────────────────
  // `git subtree` vendors another repository into a subdirectory. The files are
  // really in the tree — a plain clone gets them, with no submodule dance — but
  // git keeps no manifest of where they came from, only a `git-subtree-dir:`
  // trailer on the import commit. So this discovers prefixes from history and
  // remembers the url/ref alongside, in the repo's own config.

  async subtrees(repoPath: string): Promise<SubtreeInfo[]> {
    const git = gitFor(repoPath)
    // The trailers git subtree writes are the only trace in history.
    const body = await git
      .raw(['log', '--no-merges', '--grep=git-subtree-dir:', '--pretty=%b%x00'])
      .catch(() => '')
    const merged = await git.raw(['log', '--merges', '--grep=git-subtree-dir:', '--pretty=%b%x00']).catch(() => '')

    const found = new Map<string, string>()
    for (const record of `${body}${merged}`.split('\0')) {
      const dir = /^\s*git-subtree-dir:\s*(.+)$/m.exec(record)?.[1]?.trim().replace(/\/+$/, '')
      if (!dir) continue
      const split = /^\s*git-subtree-split:\s*([0-9a-f]+)/m.exec(record)?.[1] ?? ''
      // `log` is newest-first, so the first sighting is the latest import.
      if (!found.has(dir)) found.set(dir, split)
    }

    // Anything the user told us about, including prefixes added by another tool.
    // Legacy gitcito.subtree.* first, so a githuttbr.subtree.* value overwrites it.
    const remembered = await git
      .raw(['config', '--get-regexp', `^(${APP_ID}|${LEGACY_APP_ID})\\.subtree\\.`])
      .catch(() => '')
    const lines = remembered
      .split('\n')
      .map((line) => /^(\w+)\.subtree\.(.+)\.(url|ref)\s+(.*)$/.exec(line.trim()))
      .filter((m): m is RegExpExecArray => m !== null)
      .sort((a, b) => Number(a[1] === APP_ID) - Number(b[1] === APP_ID))
    const meta = new Map<string, { url: string; ref: string }>()
    for (const match of lines) {
      const [, , key, field, value] = match
      const prefix = decodeSubtreeKey(key)
      const entry = meta.get(prefix) ?? { url: '', ref: '' }
      if (field === 'url') entry.url = value
      else entry.ref = value
      meta.set(prefix, entry)
      if (!found.has(prefix)) found.set(prefix, '')
    }

    const out: SubtreeInfo[] = []
    for (const [prefix, lastSplit] of found) {
      out.push({
        prefix,
        // The renderer shows and sends this back; a password in it stays in main
        // (`rememberedSubtreeUrl` restores it when the same address comes back).
        url: urlWithoutPassword(meta.get(prefix)?.url ?? ''),
        ref: meta.get(prefix)?.ref ?? '',
        present: existsSync(join(repoPath, prefix)),
        lastSplit
      })
    }
    return out.sort((a, b) => a.prefix.localeCompare(b.prefix))
  },

  /** Vendor a repository into `prefix`, and remember where it came from. */
  async subtreeAdd(
    repoPath: string,
    prefix: string,
    url: string,
    ref: string,
    squash = true
  ): Promise<void> {
    const dir = prefix.trim().replace(/^\/+|\/+$/g, '')
    if (!dir || !url.trim() || !ref.trim()) throw new Error('A prefix, a repository and a ref are all required.')
    if (existsSync(join(repoPath, dir))) throw new Error(`"${dir}" already exists — subtree add needs a free path.`)
    await runSubtree(repoPath, ['add', `--prefix=${dir}`, ...(squash ? ['--squash'] : []), url.trim(), ref.trim()])
    await rememberSubtree(repoPath, dir, url.trim(), ref.trim())
  },

  /** Pull upstream changes into an existing subtree. */
  async subtreePull(repoPath: string, prefix: string, url: string, ref: string, squash = true): Promise<void> {
    if (!url.trim() || !ref.trim()) throw new Error('This subtree has no remembered repository — enter one.')
    url = await rememberedSubtreeUrl(repoPath, prefix, url.trim())
    await runSubtree(repoPath, ['pull', `--prefix=${prefix}`, ...(squash ? ['--squash'] : []), url.trim(), ref.trim()])
    await rememberSubtree(repoPath, prefix, url.trim(), ref.trim())
  },

  /** Send local changes under `prefix` back to the source repository. */
  async subtreePush(repoPath: string, prefix: string, url: string, ref: string): Promise<void> {
    if (!url.trim() || !ref.trim()) throw new Error('This subtree has no remembered repository — enter one.')
    url = await rememberedSubtreeUrl(repoPath, prefix, url.trim())
    await runSubtree(repoPath, ['push', `--prefix=${prefix}`, url.trim(), ref.trim()])
  },

  /** Extract the subtree's own history into a local branch. */
  async subtreeSplit(repoPath: string, prefix: string, branch: string): Promise<string> {
    const name = branch.trim()
    if (!name) throw new Error('A branch name is required.')
    const out = await runSubtree(repoPath, ['split', `--prefix=${prefix}`, '-b', name])
    return out.trim()
  },

  /** Forget the remembered url/ref. Touches no files and no history. */
  async subtreeForget(repoPath: string, prefix: string): Promise<void> {
    const key = encodeSubtreeKey(prefix)
    const git = gitFor(repoPath)
    for (const ns of APP_IDS) {
      for (const field of ['url', 'ref']) {
        await git.raw(['config', '--unset', `${ns}.subtree.${key}.${field}`]).catch(() => undefined)
      }
    }
  },

  // ─── Notes ───────────────────────────────────────────────────────────────
  // `git notes` attaches text to a commit without touching the commit itself —
  // the only way to annotate history that is already published. Gitcito uses the
  // default `refs/notes/commits` ref, which is what `git log` and every other
  // tool reads by default.

  /** The note attached to a commit, or '' when it has none. */
  async note(repoPath: string, sha: string): Promise<string> {
    // `notes show` exits 1 for "no note", which is an answer, not a failure.
    return (await runGit(repoPath, ['notes', 'show', sha]).catch(() => '')).replace(/\n+$/, '')
  },

  /** Commits that carry a note. One cheap call, so the graph can mark them. */
  async notedCommits(repoPath: string): Promise<string[]> {
    const raw = await runGit(repoPath, ['notes', 'list']).catch(() => '')
    return raw
      .split('\n')
      .map((line) => line.trim().split(' ')[1])
      .filter((sha): sha is string => !!sha)
  },

  /** Write (or overwrite) a commit's note. An empty text removes it instead. */
  async setNote(repoPath: string, sha: string, text: string): Promise<void> {
    if (!text.trim()) return gitService.removeNote(repoPath, sha)
    // `-F -` would need stdin; a temp file keeps multi-line notes intact without
    // fighting the shell over quoting.
    const { writeFile, rm, mkdtemp } = await import('fs/promises')
    const { tmpdir } = await import('os')
    const dir = await mkdtemp(join(tmpdir(), 'githuttbr-note-'))
    const file = join(dir, 'note.txt')
    try {
      await writeFile(file, text, 'utf-8')
      await runGit(repoPath, ['notes', 'add', '--force', '-F', file, sha])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  },

  async removeNote(repoPath: string, sha: string): Promise<void> {
    await runGit(repoPath, ['notes', 'remove', '--ignore-missing', sha])
  },

  /**
   * Notes live under `refs/notes/*`, which a normal fetch or push ignores
   * entirely — the single most common reason someone's notes "disappear" on
   * another machine. These two move them explicitly. Only the user-facing
   * commit-notes ref travels: a wildcard would also publish the app's own
   * refs/notes/githuttbr-ci (and legacy gitcito-ci) verdicts, which are promised to stay local.
   */
  async fetchNotes(repoPath: string, remote = 'origin'): Promise<void> {
    await withRemoteAuth(repoPath, remote, 'fetch', () =>
      runGit(repoPath, ['fetch', '--', remote, '+refs/notes/commits:refs/notes/commits'])
    )
  },

  async pushNotes(repoPath: string, remote = 'origin'): Promise<void> {
    await withRemoteAuth(repoPath, remote, 'push', () => runGit(repoPath, ['push', '--', remote, 'refs/notes/commits']))
  },

  // ─── Removing a path from history ────────────────────────────────────────
  // The last resort after the secret guard has already failed: a token, or a
  // 400 MB file, that is committed and cannot be un-committed by reverting.
  // Every commit from the first touch onwards is rewritten, so this is measured
  // first, backed up second, and only then run.

  /**
   * Every path that has ever been committed, heaviest first.
   *
   * A file dialog cannot answer this question: the interesting paths are the
   * ones already deleted from the working tree, which is exactly what a picker
   * over the filesystem cannot see. Sorting by bytes also makes the other
   * reason for a purge — "why is this clone two gigabytes" — self-answering.
   */
  async historyPaths(repoPath: string, max = 400): Promise<HistoryPathEntry[]> {
    // One pass for sizes of every object in the database…
    const sizes = new Map<string, number>()
    const sized = await runGit(repoPath, [
      'cat-file',
      '--batch-all-objects',
      '--batch-check=%(objectname) %(objecttype) %(objectsize)'
    ]).catch(() => '')
    for (const line of sized.split('\n')) {
      const [sha, type, size] = line.split(' ')
      if (type === 'blob') sizes.set(sha, Number(size) || 0)
    }

    // …and one for which of them were ever recorded under which name.
    const named = await runGit(repoPath, ['rev-list', '--objects', '--all']).catch(() => '')
    const byPath = new Map<string, { bytes: number; blobs: Set<string> }>()
    for (const line of named.split('\n')) {
      const space = line.indexOf(' ')
      if (space <= 0) continue
      const sha = line.slice(0, space)
      const size = sizes.get(sha)
      if (size === undefined) continue // a tree, not a blob
      const path = line.slice(space + 1).trim()
      if (!path) continue
      const entry = byPath.get(path) ?? { bytes: 0, blobs: new Set<string>() }
      // The same blob under the same path is one copy, not several.
      if (!entry.blobs.has(sha)) {
        entry.blobs.add(sha)
        entry.bytes += size
      }
      byPath.set(path, entry)
    }

    const tracked = new Set(
      (await runGit(repoPath, ['ls-files']).catch(() => '')).split('\n').map((p) => p.trim()).filter(Boolean)
    )
    return [...byPath.entries()]
      .map(([path, entry]) => ({
        path,
        bytes: entry.bytes,
        versions: entry.blobs.size,
        deleted: !tracked.has(path)
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, max)
  },

  async historyPurgePreview(repoPath: string, paths: string[]): Promise<HistoryPurgePreview> {
    const git = gitFor(repoPath)
    const clean = paths.map((p) => p.trim()).filter(Boolean)
    const empty: HistoryPurgePreview = {
      paths: clean,
      commits: 0,
      firstCommit: null,
      branches: [],
      tags: [],
      bytes: 0,
      blocked: ''
    }
    if (!clean.length) return { ...empty, blocked: 'Choose at least one path.' }

    // A rewrite rewrites the checkout too, so anything uncommitted would be at
    // risk — and a half-finished merge has no single history to rewrite.
    const status = await git.status()
    const state = await gitService.mergeState(repoPath)
    const blocked = state
      ? 'Finish or abort the operation in progress first.'
      : status.files.length
        ? 'Commit or stash your changes first.'
        : ''

    // `--branches --tags` mirrors exactly what the rewrite will touch. `--all`
    // would also walk `refs/githuttbr/pre-purge/*`, so a second purge in the same
    // repository would count commits that only a previous backup still holds
    // and promise work the rewrite is not going to do.
    const log = await git
      .raw(['log', '--branches', '--tags', '--format=%H%x00%s%x00%at', '--', ...clean])
      .catch(() => '')
    const entries = log
      .split('\n')
      .map((line) => line.split('\0'))
      .filter((parts) => parts.length === 3)
    const oldest = entries[entries.length - 1]

    const refs = (await git.raw(['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/tags']).catch(() => ''))
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean)

    return {
      paths: clean,
      commits: entries.length,
      firstCommit: oldest ? { sha: oldest[0], subject: oldest[1], date: Number(oldest[2]) } : null,
      branches: refs.filter((r) => r.startsWith('refs/heads/')).map((r) => r.slice('refs/heads/'.length)),
      tags: refs.filter((r) => r.startsWith('refs/tags/')).map((r) => r.slice('refs/tags/'.length)),
      bytes: await blobBytesForPaths(repoPath, clean),
      blocked
    }
  },

  /**
   * Rewrite every branch and tag without the given paths, after copying each ref
   * to `refs/githuttbr/pre-purge/<timestamp>/…`.
   *
   * The backup is deliberately outside `--all`'s reach, so the rewrite cannot
   * eat its own safety net — and it keeps the old objects alive, which is why
   * space is only reclaimed once the backup is dropped.
   */
  async historyPurge(repoPath: string, paths: string[]): Promise<HistoryPurgeResult> {
    const git = gitFor(repoPath)
    const clean = paths.map((p) => p.trim()).filter(Boolean)
    if (!clean.length) throw new Error('Choose at least one path.')

    const preview = await gitService.historyPurgePreview(repoPath, clean)
    if (preview.blocked) throw new Error(preview.blocked)
    if (!preview.commits) throw new Error('No commit touches that path — nothing to rewrite.')

    const at = Math.floor(Date.now() / 1000)
    const prefix = `${prePurgeRefRoot()}/${at}`
    const refs = (await git.raw(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/tags']))
      .split('\n')
      .map((line) => line.trim().split(' '))
      .filter((parts) => parts.length === 2)
    for (const [name, sha] of refs) {
      await git.raw(['update-ref', `${prefix}/${name.replace(/^refs\//, '')}`, sha])
    }
    // Record what was purged, so the UI can label the backup later. A git
    // config key has to start with a letter, hence the `at` prefix.
    await git.raw(['config', prePurgeKey(at), clean.join('\n')])

    // `--index-filter` rewrites the index directly — no checkout per commit,
    // which is the difference between minutes and hours on a real history.
    // `--branches --tags` rather than `--all`: `--all` would include the backup.
    const rm = ['git', 'rm', '--cached', '--ignore-unmatch', '--'].concat(clean.map((p) => `'${p.replace(/'/g, "'\\''")}'`))
    await pexecFile(
      'git',
      [
        '-C',
        repoPath,
        'filter-branch',
        '--force',
        '--index-filter',
        rm.join(' '),
        '--prune-empty',
        // Without this, tags keep pointing at the pre-rewrite commits.
        '--tag-name-filter',
        'cat',
        '--',
        '--branches',
        '--tags'
      ],
      {
        env: { ...process.env, FILTER_BRANCH_SQUELCH_WARNING: '1', GIT_TERMINAL_PROMPT: '0' },
        maxBuffer: 64 * 1024 * 1024
      }
    )

    // filter-branch leaves its own copies under refs/original; ours supersedes
    // them, and leaving both means twice the confusion about which to restore.
    const originals = (await git.raw(['for-each-ref', '--format=%(refname)', 'refs/original']).catch(() => ''))
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean)
    for (const ref of originals) await git.raw(['update-ref', '-d', ref]).catch(() => undefined)

    return {
      backup: { prefix, at, refs: refs.length, paths: clean },
      rewritten: refs.length
    }
  },

  /** Every purge backup still in the repository, newest first. */
  async historyPurgeBackups(repoPath: string): Promise<HistoryPurgeBackup[]> {
    const git = gitFor(repoPath)
    // Backups a purge made before the rename sit under refs/gitcito/pre-purge
    // and stay listed, restorable and droppable.
    const refs = (
      await git.raw(['for-each-ref', '--format=%(refname)', ...APP_IDS.map(prePurgeRefRoot)]).catch(() => '')
    )
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean)

    const byPrefix = new Map<string, { ns: string; at: number; count: number }>()
    for (const ref of refs) {
      const [, ns, , stamp] = ref.split('/')
      const at = Number(stamp)
      if (!Number.isFinite(at)) continue
      const prefix = `${prePurgeRefRoot(ns)}/${at}`
      const entry = byPrefix.get(prefix) ?? { ns, at, count: 0 }
      entry.count++
      byPrefix.set(prefix, entry)
    }
    const out: HistoryPurgeBackup[] = []
    for (const [prefix, { ns, at, count }] of byPrefix) {
      const recorded = await git.raw(['config', '--get', prePurgeKey(at, ns)]).catch(() => '')
      out.push({
        prefix,
        at,
        refs: count,
        paths: recorded.trim() ? recorded.trim().split('\n') : []
      })
    }
    return out.sort((a, b) => b.at - a.at)
  },

  /** Put every branch and tag back where the backup says it was. */
  async historyPurgeRestore(repoPath: string, prefix: string): Promise<void> {
    const git = gitFor(repoPath)
    if (!isPrePurgePrefix(prefix)) throw new Error('Not a purge backup.')
    const saved = (await git.raw(['for-each-ref', '--format=%(refname) %(objectname)', prefix]))
      .split('\n')
      .map((line) => line.trim().split(' '))
      .filter((parts) => parts.length === 2)
    if (!saved.length) throw new Error('That backup is empty.')

    // Detach first: the branch we are standing on is about to move under us.
    await runGit(repoPath, ['checkout', '--detach']).catch(() => undefined)
    for (const [ref, sha] of saved) {
      const original = `refs/${ref.slice(`${prefix}/`.length)}`
      await git.raw(['update-ref', original, sha])
    }
    const head = saved.find(([ref]) => ref.includes('/heads/'))
    if (head) await runGit(repoPath, ['checkout', head[0].split('/heads/')[1]])
  },

  /**
   * Delete a backup and garbage-collect. This is what actually reclaims the
   * space — and what makes the purge irreversible.
   */
  async historyPurgeDropBackup(repoPath: string, prefix: string): Promise<void> {
    const git = gitFor(repoPath)
    if (!isPrePurgePrefix(prefix)) throw new Error('Not a purge backup.')
    const refs = (await git.raw(['for-each-ref', '--format=%(refname)', prefix]).catch(() => ''))
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean)
    for (const ref of refs) await git.raw(['update-ref', '-d', ref]).catch(() => undefined)
    const [, ns, , stamp] = prefix.split('/')
    await git.raw(['config', '--unset', prePurgeKey(Number(stamp), ns)]).catch(() => undefined)
    // The old commits are only unreachable once the reflog forgets them too.
    await git.raw(['reflog', 'expire', '--expire=now', '--all']).catch(() => undefined)
    await git.raw(['gc', '--prune=now']).catch(() => undefined)
  },

  // ─── git-flow ────────────────────────────────────────────────────────────
  // Stored under the same `gitflow.*` keys the `git flow` CLI writes, so a repo
  // set up by either tool reads correctly in the other. Gitcito runs plain git
  // commands throughout — the CLI is never required to be installed.

  async gitflowStatus(repoPath: string): Promise<GitflowStatus> {
    const git = gitFor(repoPath)
    const read = async (key: string): Promise<string | null> =>
      (await git.raw(['config', '--get', key]).catch(() => null))?.trim() || null

    const [master, develop, feature, release, hotfix, versionTag] = await Promise.all([
      read('gitflow.branch.master'),
      read('gitflow.branch.develop'),
      read('gitflow.prefix.feature'),
      read('gitflow.prefix.release'),
      read('gitflow.prefix.hotfix'),
      read('gitflow.prefix.versiontag')
    ])

    const locals = (await git.raw(['for-each-ref', '--format=%(refname:short)', 'refs/heads']).catch(() => ''))
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    // Nothing configured yet: propose a layout that matches what is already
    // there rather than one the user then has to correct.
    const config: GitflowConfig = {
      main: master ?? (locals.includes('main') ? 'main' : locals.includes('master') ? 'master' : 'main'),
      develop: develop ?? 'develop',
      featurePrefix: feature ?? 'feature/',
      releasePrefix: release ?? 'release/',
      hotfixPrefix: hotfix ?? 'hotfix/',
      versionTagPrefix: versionTag ?? 'v'
    }

    const current = (await git.raw(['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => '')).trim()
    const match = (['feature', 'release', 'hotfix'] as GitflowKind[])
      .map((kind) => ({ kind, prefix: prefixFor(config, kind) }))
      .find(({ prefix }) => prefix && current.startsWith(prefix))

    return {
      config,
      initialized: !!master && !!develop,
      hasMain: locals.includes(config.main),
      hasDevelop: locals.includes(config.develop),
      current,
      currentFlow: match ? { kind: match.kind, name: current.slice(match.prefix.length) } : null
    }
  },

  /** Write the layout and create the develop branch if it does not exist yet. */
  async gitflowInit(repoPath: string, config: GitflowConfig): Promise<void> {
    const git = gitFor(repoPath)
    const entries: [string, string][] = [
      ['gitflow.branch.master', config.main],
      ['gitflow.branch.develop', config.develop],
      ['gitflow.prefix.feature', config.featurePrefix],
      ['gitflow.prefix.release', config.releasePrefix],
      ['gitflow.prefix.hotfix', config.hotfixPrefix],
      ['gitflow.prefix.versiontag', config.versionTagPrefix]
    ]
    for (const [key, value] of entries) await git.raw(['config', key, value])

    const locals = await localBranches(repoPath)
    if (!locals.includes(config.main)) throw new Error(`Branch "${config.main}" does not exist.`)
    // develop is the one branch this can reasonably create: it starts at main.
    if (!locals.includes(config.develop)) await git.raw(['branch', config.develop, config.main])
  },

  /** Branch off the right base and check the new branch out. Returns its name. */
  async gitflowStart(repoPath: string, kind: GitflowKind, name: string): Promise<string> {
    const status = await gitService.gitflowStatus(repoPath)
    const branch = prefixFor(status.config, kind) + name.trim()
    if (!name.trim()) throw new Error('A name is required.')
    // Features integrate through develop; releases and hotfixes ship from main.
    const base = kind === 'hotfix' ? status.config.main : status.config.develop
    const locals = await localBranches(repoPath)
    if (locals.includes(branch)) throw new Error(`Branch "${branch}" already exists.`)
    if (!locals.includes(base)) throw new Error(`Branch "${base}" does not exist.`)
    await runGit(repoPath, ['checkout', '-b', branch, base])
    return branch
  },

  /**
   * Close a flow branch: merge it where it belongs, tag a release/hotfix, and
   * delete the branch. Returns the refs as they were, so `gitflowUndo` can put
   * everything back — a merge conflict aborts and leaves nothing behind.
   */
  async gitflowFinish(
    repoPath: string,
    kind: GitflowKind,
    name: string,
    opts: { tag?: boolean; deleteBranch?: boolean; message?: string } = {}
  ): Promise<GitflowSnapshot> {
    const git = gitFor(repoPath)
    const status = await gitService.gitflowStatus(repoPath)
    const branch = prefixFor(status.config, kind) + name.trim()
    const { main, develop } = status.config

    const dirty = (await git.status()).files.length > 0
    if (dirty) throw new Error('Commit or stash your changes before finishing a branch.')

    const locals = await localBranches(repoPath)
    if (!locals.includes(branch)) throw new Error(`Branch "${branch}" does not exist.`)

    // Features land on develop only; releases and hotfixes land on main first,
    // are tagged there, and are then merged back so develop keeps the fixes.
    const targets = kind === 'feature' ? [develop] : [main, develop]
    for (const target of targets) {
      if (!locals.includes(target)) throw new Error(`Branch "${target}" does not exist.`)
    }

    const shaOf = async (ref: string): Promise<string> => (await git.raw(['rev-parse', ref])).trim()
    const snapshot: GitflowSnapshot = {
      refs: await Promise.all(targets.map(async (name) => ({ name, sha: await shaOf(name) }))),
      tag: null,
      branch: { name: branch, sha: await shaOf(branch) }
    }
    const tagName = opts.tag !== false && kind !== 'feature' ? status.config.versionTagPrefix + name.trim() : null

    try {
      for (const target of targets) {
        await runGit(repoPath, ['checkout', target])
        // --no-ff keeps the branch visible in the graph, which is the whole
        // point of the layout: you can see where a feature began and ended.
        await runGit(repoPath, ['merge', '--no-ff', '-m', `Merge branch '${branch}' into ${target}`, branch])
        if (tagName && target === main) {
          await runGit(repoPath, ['tag', '-a', tagName, '-m', opts.message?.trim() || `Release ${name.trim()}`])
          snapshot.tag = tagName
        }
      }
      if (opts.deleteBranch !== false) await runGit(repoPath, ['branch', '-d', branch])
    } catch (err) {
      // A conflicted merge would strand the repo mid-flow. Roll every ref back
      // to where it started and hand the error on untouched.
      await gitService.gitflowUndo(repoPath, snapshot).catch(() => {
        /* the original failure is the one worth reporting */
      })
      throw err
    }

    // End where the work continues: develop for a feature or release, main for
    // a hotfix that has just shipped.
    await runGit(repoPath, ['checkout', kind === 'hotfix' ? main : develop])
    return snapshot
  },

  /** Put every ref a finish moved back where it was, drop the tag, restore the branch. */
  async gitflowUndo(repoPath: string, snapshot: GitflowSnapshot): Promise<void> {
    const git = gitFor(repoPath)
    // Move off anything about to be rewound so the reset below cannot fail.
    await runGit(repoPath, ['checkout', '--detach']).catch(() => undefined)
    for (const ref of snapshot.refs) {
      await git.raw(['update-ref', `refs/heads/${ref.name}`, ref.sha])
    }
    if (snapshot.tag) await git.raw(['tag', '-d', snapshot.tag]).catch(() => undefined)
    const locals = await localBranches(repoPath)
    if (!locals.includes(snapshot.branch.name)) {
      await git.raw(['branch', snapshot.branch.name, snapshot.branch.sha])
    }
    await runGit(repoPath, ['checkout', snapshot.branch.name])
  },

  /** Tracked files only (in the index) — for the push-time secret guard. */
  async listTrackedFiles(repoPath: string): Promise<string[]> {
    const raw = await gitFor(repoPath).raw(['ls-files', '--cached', '-z']).catch(() => '')
    return raw.split('\0').filter(Boolean)
  },

  /**
   * Tracked paths that are also matched by an ignore rule. Git normally keeps
   * tracking these files, but AI context deliberately honours the rule as a
   * privacy boundary. `--no-index` makes check-ignore consider tracked paths.
   */
  async ignoredTrackedFiles(repoPath: string, paths: string[]): Promise<string[]> {
    const ignored: string[] = []
    for (let i = 0; i < paths.length; i += 200) {
      const chunk = paths.slice(i, i + 200)
      if (!chunk.length) continue
      // `check-ignore` exits 1 when nothing matched — success, not failure.
      // Any other non-zero code has to propagate: swallowing it would report
      // "nothing is ignored" and hand ignored files to the caller.
      const stdout = await pexecFile(
        'git',
        ['-C', repoPath, 'check-ignore', '--no-index', '--', ...chunk],
        { env: noPromptEnv(), maxBuffer: 16 * 1024 * 1024 }
      )
        .then((res) => res.stdout)
        .catch((err: { code?: number | string; stdout?: string; message?: string }) => {
          if (err.code === 1) return err.stdout ?? ''
          throw new Error(`Could not determine ignored files: ${err.message}`)
        })
      ignored.push(...stdout.split('\n').map((line) => line.trim()).filter(Boolean))
    }
    return ignored
  },

  /** Apply a validated repository-chat file batch under the Git IPC write lock. */
  async applyRepoFileActions(
    repoPath: string,
    actions: PreparedRepoChatFileAction[]
  ): Promise<RepoFileBatchResult> {
    const paths = [...new Set(actions.map((action) => action.path))]
    const ignored = new Set(await gitService.ignoredTrackedFiles(repoPath, paths))
    try {
      const result = await applyPreparedRepoFileActions(repoPath, actions, ignored)
      return { ok: true, applied: result.applied }
    } catch (error) {
      if (error instanceof RepoFileActionError) {
        return {
          ok: false,
          error: { code: error.code, detail: error.message, paths: error.paths }
        }
      }
      throw error
    }
  },

  /** Author, date and message of one commit — for pinned chat context. */
  async commitSummary(
    repoPath: string,
    hash: string
  ): Promise<{ hash: string; author: string; date: string; subject: string; body: string }> {
    const raw = await gitFor(repoPath).raw([
      'show',
      '-s',
      '--format=%H%x00%an%x00%aI%x00%s%x00%b',
      hash
    ])
    const [full = '', author = '', date = '', subject = '', body = ''] = raw.split('\0')
    return { hash: full.trim(), author, date, subject, body: body.trim() }
  },

  /**
   * Files that this push would actually publish: the ones changed in the
   * commits ahead of the upstream. Used by the secret-push guard so it only
   * warns about credentials introduced by the unpushed commits, not every
   * secret already tracked (and long since pushed) in the repo.
   *
   * With no upstream (branch never pushed), the whole history publishes, so
   * fall back to every tracked file.
   */
  async filesToPush(repoPath: string, branch: string): Promise<string[]> {
    const git = gitFor(repoPath)
    const upstream = await git
      .raw(['rev-parse', '--abbrev-ref', '--symbolic-full-name', `${branch}@{upstream}`])
      .then((s) => s.trim())
      .catch(() => '')
    if (!upstream) return this.listTrackedFiles(repoPath)
    const raw = await git.raw(['diff', '--name-only', '-z', `${upstream}..${branch}`]).catch(() => '')
    return raw.split('\0').filter(Boolean)
  },

  /** Commit hashes that touched `path` (file or folder) — for the graph path filter. */
  async commitsTouchingPath(repoPath: string, path: string, max = 1000): Promise<string[]> {
    const raw = await gitFor(repoPath)
      .raw(['log', '--format=%H', `--max-count=${max}`, '--', path])
      .catch(() => '')
    return raw.split('\n').filter(Boolean)
  },

  /** Byte size + binary-ness of working-tree files — for the large-file commit guard. */
  async fileSizes(repoPath: string, files: string[]): Promise<Record<string, { size: number; binary: boolean }>> {
    const out: Record<string, { size: number; binary: boolean }> = {}
    await Promise.all(
      files.map(async (f) => {
        try {
          const abs = join(repoPath, f)
          const st = await stat(abs)
          // Sniff the first 8KB for a NUL byte → treat as binary. Read only
          // that window — reading whole files here would buffer every staged
          // file at once, OOMing on the very large files this guard exists for.
          let binary = false
          try {
            const fh = await open(abs, 'r')
            try {
              const buf = Buffer.alloc(8192)
              const { bytesRead } = await fh.read(buf, 0, 8192, 0)
              binary = buf.subarray(0, bytesRead).includes(0)
            } finally {
              await fh.close()
            }
          } catch {
            /* unreadable → leave non-binary */
          }
          out[f] = { size: st.size, binary }
        } catch {
          /* missing/deleted → skip */
        }
      })
    )
    return out
  },

  /**
   * Map of repo-relative path → status kind for every changed/untracked/ignored
   * path, from a single `git status --porcelain --ignored -uall` call. Directory
   * paths are also populated with an aggregated status so folders can show a dot
   * when something inside them changed. Clean tracked files are absent (= clean).
   */
  async treeStatus(repoPath: string): Promise<Record<string, TreeStatusKind>> {
    // Shares the refresh's single status walk — see `statusScan`. Failing soft
    // matches the old behaviour: no badges is a worse tree, not a broken one.
    const st = await statusScan(repoPath).catch(() => null)
    const out: Record<string, TreeStatusKind> = {}
    if (!st) return out
    // Priority when a folder aggregates mixed child statuses (higher wins).
    const rank: Record<TreeStatusKind, number> = {
      conflicted: 6, modified: 5, added: 4, deleted: 3, renamed: 2, untracked: 1, ignored: 0
    }
    const bump = (p: string, kind: TreeStatusKind): void => {
      const cur = out[p]
      if (!cur || rank[kind] > rank[cur]) out[p] = kind
    }
    // An untracked directory arrives as "tmp/" — strip the slash so it keys the
    // same way the tree addresses it.
    const clean = (p: string): string => p.replace(/\/$/, '')

    for (const f of st.files) {
      const x = f.index
      const y = f.working_dir
      const kind: TreeStatusKind =
        x === '?' || y === '?' ? 'untracked'
          : x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D') ? 'conflicted'
          : x === 'R' || y === 'R' ? 'renamed'
          : x === 'A' || y === 'A' ? 'added'
          : x === 'D' || y === 'D' ? 'deleted'
          : 'modified'
      const path = clean(f.path)
      bump(path, kind)
      // Propagate to ancestor directories so a collapsed folder can show a dot.
      let slash = path.lastIndexOf('/')
      while (slash > 0) {
        bump(path.slice(0, slash), kind)
        slash = path.lastIndexOf('/', slash - 1)
      }
    }

    // Ignored stays leaf-only, so a whole ignored tree does not paint every
    // parent grey. `--ignored=matching` reports the directory itself, and
    // `treeStatusOf` in the renderer resolves the files inside it.
    for (const p of st.ignored ?? []) bump(clean(p), 'ignored')
    return out
  },

  /** Create an empty file or a directory at `relPath` (repo-relative). */
  async fsCreate(repoPath: string, relPath: string, isDir: boolean): Promise<void> {
    const abs = join(repoPath, relPath)
    if (existsSync(abs)) throw new Error(`Already exists: ${relPath}`)
    if (isDir) {
      await mkdir(abs, { recursive: true })
    } else {
      await mkdir(join(abs, '..'), { recursive: true })
      await writeFile(abs, '', 'utf8')
    }
  },

  /** Rename/move a path within the repo (uses `git mv` when tracked so history
   *  follows, else a plain fs rename for untracked paths). */
  async fsRename(repoPath: string, from: string, to: string): Promise<void> {
    if (from === to) return
    const dest = join(repoPath, to)
    if (existsSync(dest)) throw new Error(`Already exists: ${to}`)
    await mkdir(join(dest, '..'), { recursive: true })
    const tracked = (await gitFor(repoPath).raw(['ls-files', '--', from]).catch(() => '')).trim()
    if (tracked) {
      await gitFor(repoPath).raw(['mv', from, to])
    } else {
      await rename(join(repoPath, from), dest)
    }
  },

  /** Move paths to the OS trash (recoverable). Refuses paths outside the repo. */
  async fsDelete(repoPath: string, relPaths: string[]): Promise<void> {
    for (const rel of relPaths) {
      const abs = join(repoPath, rel)
      if (!abs.startsWith(repoPath)) throw new Error(`Refusing to delete outside repo: ${rel}`)
      await shell.trashItem(abs)
    }
  },

  /** Base names of `names` that already exist in `destDir` — the renderer asks
   *  this before a drop so it can offer "Replace" / "Keep both". */
  async fsExisting(repoPath: string, destDir: string, names: string[]): Promise<string[]> {
    const destAbs = join(repoPath, destDir.replace(/^\/+|\/+$/g, ''))
    return names.filter((n) => existsSync(join(destAbs, basename(n))))
  },

  /** Move repo-relative paths into `destDir` ('' = repo root), keeping their base
   *  names. Refuses to move a folder into itself or one of its descendants.
   *  `mode` decides what an existing name at the destination means: fail (default),
   *  trash it first, or land next to it under a free name. */
  async fsMove(repoPath: string, froms: string[], destDir: string, mode: FsDropMode = 'error'): Promise<void> {
    const dir = destDir.replace(/^\/+|\/+$/g, '')
    for (const from of froms) {
      const src = from.replace(/^\/+|\/+$/g, '')
      if (dir === src || dir.startsWith(`${src}/`)) throw new Error(`Cannot move ${src} into itself`)
      const name = await resolveDrop(repoPath, dir, basename(src), mode)
      await gitService.fsRename(repoPath, src, dir ? `${dir}/${name}` : name)
    }
  },

  /** Copy absolute paths dropped from the OS into `destDir` ('' = repo root).
   *  Sources that already live inside this repo are moved instead of duplicated. */
  async fsImport(
    repoPath: string,
    srcPaths: string[],
    destDir: string,
    mode: FsDropMode = 'error'
  ): Promise<void> {
    const dir = destDir.replace(/^\/+|\/+$/g, '')
    const destAbs = join(repoPath, dir)
    if (!destAbs.startsWith(repoPath)) throw new Error(`Refusing to write outside repo: ${destDir}`)
    await mkdir(destAbs, { recursive: true })
    for (const src of srcPaths) {
      if (src === join(destAbs, basename(src))) continue
      if (src.startsWith(`${repoPath}/`)) {
        // Dropped from inside this repo (e.g. Finder) — a move keeps git history.
        await gitService.fsMove(repoPath, [src.slice(repoPath.length + 1)], dir, mode)
      } else {
        const name = await resolveDrop(repoPath, dir, basename(src), mode)
        await cp(src, join(destAbs, name), { recursive: true })
      }
    }
  },

  async commit(repoPath: string, message: string, amend = false): Promise<void> {
    const git = gitFor(repoPath)
    await git.commit(message, amend ? ['--amend'] : [])
  },

  async getCommitMessage(repoPath: string, hash: string): Promise<string> {
    return gitFor(repoPath).raw(['log', '-1', '--format=%B', hash])
  },

  /** Full SHA for any revision expression — `HEAD~2`, a tag, a short hash.
   *  Returns null rather than throwing when it names nothing: the caller is
   *  usually turning user input into a selection, and "no such commit" is an
   *  answer, not a failure. */
  async resolveRev(repoPath: string, rev: string): Promise<string | null> {
    // `^{commit}` peels an annotated tag down to the commit it points at, so a
    // tag name selects the commit rather than the tag object.
    const out = await gitFor(repoPath)
      .raw(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`])
      .catch(() => '')
    const sha = out.trim()
    return /^[0-9a-f]{40}$/.test(sha) ? sha : null
  },

  async amendCommitMessage(repoPath: string, message: string): Promise<void> {
    await gitFor(repoPath).raw(['commit', '--amend', '--only', '-m', message])
  },

  /**
   * Contents of the repo's `commit.template` (.gitmessage), or '' if none is
   * configured / the file is missing. Path is resolved against ~ and the repo
   * root so both absolute and relative `commit.template` settings work.
   */
  async commitTemplate(repoPath: string): Promise<string> {
    const tpl = (await gitFor(repoPath).raw(['config', '--get', 'commit.template']).catch(() => '')).trim()
    if (!tpl) return ''
    let p = tpl
    if (p === '~' || p.startsWith('~/')) p = join(homedir(), p.slice(1))
    else if (!p.startsWith('/')) p = join(repoPath, p)
    return readFile(p, 'utf-8').catch(() => '')
  },

  /** Read this repo's commit-signing configuration. */
  async signingConfig(repoPath: string): Promise<SigningConfig> {
    const git = gitFor(repoPath)
    const get = async (key: string): Promise<string> =>
      (await git.raw(['config', '--get', key]).catch(() => '')).trim()
    const [sign, format, key] = await Promise.all([
      get('commit.gpgsign'),
      get('gpg.format'),
      get('user.signingkey')
    ])
    return { sign: sign === 'true', format: format || 'openpgp', key }
  },

  /** Update this repo's commit-signing configuration (only provided fields). */
  async setSigningConfig(
    repoPath: string,
    opts: { sign?: boolean; format?: string; key?: string }
  ): Promise<void> {
    const git = gitFor(repoPath)
    if (opts.sign !== undefined) await git.raw(['config', 'commit.gpgsign', String(opts.sign)])
    if (opts.format !== undefined) await git.raw(['config', 'gpg.format', opts.format])
    if (opts.key !== undefined) {
      if (opts.key) await git.raw(['config', 'user.signingkey', opts.key])
      else await git.raw(['config', '--unset', 'user.signingkey']).catch(() => {})
    }
  },

  // ─── Hooks ─────────────────────────────────────────────────────────────────

  /** Enumerate the repo's hooks + detect a custom hooksPath / pre-commit framework. */
  async hooksInfo(repoPath: string): Promise<HooksInfo> {
    const git = gitFor(repoPath)
    const { dir, custom } = await resolveHooksDir(git, repoPath)
    const preCommitFramework =
      existsSync(join(repoPath, '.pre-commit-config.yaml')) || existsSync(join(repoPath, '.pre-commit-config.yml'))
    const hooks: HookInfo[] = []
    for (const name of KNOWN_HOOKS) {
      const p = join(dir, name)
      let exists = false
      let executable = false
      let size = 0
      try {
        const st = await stat(p)
        exists = st.isFile()
        size = st.size
        executable = (st.mode & 0o111) !== 0
      } catch {
        /* no real hook by this name */
      }
      const sample = !exists && existsSync(`${p}.sample`)
      hooks.push({ name, exists, executable, sample, size })
    }
    return { hooksDir: dir, customHooksPath: custom, preCommitFramework, hooks }
  },

  /**
   * Read a hook's contents for editing. Falls back to the shipped `.sample`
   * template, then to a minimal shebang, so the editor is never blank.
   */
  async readHook(repoPath: string, name: string): Promise<string> {
    const git = gitFor(repoPath)
    const { dir } = await resolveHooksDir(git, repoPath)
    const p = join(dir, name)
    const real = await readFile(p, 'utf-8').catch(() => null)
    if (real !== null) return real
    const sample = await readFile(`${p}.sample`, 'utf-8').catch(() => null)
    if (sample !== null) return sample
    return '#!/bin/sh\n'
  },

  /** Write a hook and make it executable (so git will run it). */
  async writeHook(repoPath: string, name: string, content: string): Promise<void> {
    const git = gitFor(repoPath)
    const { dir } = await resolveHooksDir(git, repoPath)
    await mkdir(dir, { recursive: true }).catch(() => {})
    const p = join(dir, name)
    await writeFile(p, content, 'utf-8')
    await chmod(p, 0o755)
  },

  /** Toggle a hook's executable bit — git only runs hooks that are executable. */
  async setHookEnabled(repoPath: string, name: string, enabled: boolean): Promise<void> {
    const git = gitFor(repoPath)
    const { dir } = await resolveHooksDir(git, repoPath)
    const p = join(dir, name)
    const st = await stat(p)
    const mode = enabled ? st.mode | 0o755 : st.mode & ~0o111
    await chmod(p, mode)
  },

  /** Delete a hook file. The shipped `.sample` template (if any) is left intact. */
  async deleteHook(repoPath: string, name: string): Promise<void> {
    const git = gitFor(repoPath)
    const { dir } = await resolveHooksDir(git, repoPath)
    await unlink(join(dir, name)).catch(() => {})
  },

  // ─── Git LFS ───────────────────────────────────────────────────────────────

  /** LFS state: whether git-lfs is installed, tracked patterns, and LFS files. */
  async lfsInfo(repoPath: string): Promise<LfsInfo> {
    const git = gitFor(repoPath)
    const installed = await git
      .raw(['lfs', 'version'])
      .then(() => true)
      .catch(() => false)
    if (!installed) return { installed: false, enabled: false, patterns: [], files: [] }

    const ga = await readFile(join(repoPath, '.gitattributes'), 'utf-8').catch(() => '')
    const patterns = ga
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && /filter=lfs/.test(l))
      .map((l) => l.split(/\s+/)[0])

    const out = await git.raw(['lfs', 'ls-files']).catch(() => '')
    const files: LfsFile[] = []
    for (const line of out.split('\n').map((l) => l.trim()).filter(Boolean)) {
      // Format: "<oid> <* or -> <path>"  (* = downloaded, - = pointer only)
      const m = line.match(/^(\S+)\s+([*-])\s+(.+)$/)
      if (m) files.push({ oid: m[1], downloaded: m[2] === '*', path: m[3] })
    }
    return { installed: true, enabled: patterns.length > 0 || files.length > 0, patterns, files }
  },

  /** Track a glob pattern with LFS (writes .gitattributes). */
  async lfsTrack(repoPath: string, pattern: string): Promise<void> {
    await gitFor(repoPath).raw(['lfs', 'track', pattern])
  },

  /** Stop tracking a pattern with LFS. */
  async lfsUntrack(repoPath: string, pattern: string): Promise<void> {
    await gitFor(repoPath).raw(['lfs', 'untrack', pattern])
  },

  /** Download LFS content for pointers in the working tree. */
  async lfsPull(repoPath: string): Promise<void> {
    await gitFor(repoPath).raw(['lfs', 'pull'])
  },

  /** Prune old/unreferenced LFS objects from local storage. */
  async lfsPrune(repoPath: string): Promise<void> {
    await gitFor(repoPath).raw(['lfs', 'prune'])
  },

  // ─── Sparse-checkout ─────────────────────────────────────────────────────────

  /** Cone-mode sparse-checkout state + the top-level dirs available to toggle. */
  async sparseCheckoutInfo(repoPath: string): Promise<SparseCheckoutInfo> {
    const git = gitFor(repoPath)
    const cfg = async (key: string): Promise<string> =>
      (await git.raw(['config', '--get', key]).catch(() => '')).trim()
    const enabled = (await cfg('core.sparseCheckout')) === 'true'
    const cone = (await cfg('core.sparseCheckoutCone')) === 'true'
    const norm = (s: string): string => s.trim().replace(/^\/+|\/+$/g, '')
    const dirs = enabled
      ? (await git.raw(['sparse-checkout', 'list']).catch(() => ''))
          .split('\n')
          .map(norm)
          .filter(Boolean)
      : []
    const topLevelDirs = (await git.raw(['ls-tree', '--name-only', '-d', 'HEAD']).catch(() => ''))
      .split('\n')
      .map(norm)
      .filter(Boolean)
    return { enabled, cone, dirs, topLevelDirs }
  },

  /** Enable cone-mode sparse-checkout and restrict the working tree to `dirs`. */
  async sparseCheckoutSet(repoPath: string, dirs: string[]): Promise<void> {
    await gitFor(repoPath).raw(['sparse-checkout', 'set', '--cone', ...dirs])
  },

  /** Disable sparse-checkout — restore the full working tree. */
  async sparseCheckoutDisable(repoPath: string): Promise<void> {
    await gitFor(repoPath).raw(['sparse-checkout', 'disable'])
  },

  async cherryPick(repoPath: string, hash: string, noCommit = false): Promise<void> {
    const args = ['cherry-pick']
    if (noCommit) args.push('-n')
    args.push(hash)
    await withRerereCapture(repoPath, () => gitFor(repoPath).raw(args))
  },

  // Cherry-pick several commits in one go. Hashes are applied in the given
  // order, so callers should pass them oldest-first to preserve history order.
  async cherryPickMany(repoPath: string, hashes: string[], noCommit = false): Promise<void> {
    if (!hashes.length) return
    const args = ['cherry-pick']
    if (noCommit) args.push('-n')
    args.push(...hashes)
    await withRerereCapture(repoPath, () => gitFor(repoPath).raw(args))
  },

  async revertCommit(repoPath: string, hash: string): Promise<void> {
    await gitFor(repoPath).raw(['revert', '--no-edit', hash])
  },

  async reset(repoPath: string, ref: string, mode: 'soft' | 'mixed' | 'hard' | 'keep'): Promise<void> {
    // Only --hard destroys working-tree content; soft/mixed move refs/index and
    // --keep carries local changes over or aborts.
    if (mode === 'hard') await guardSnapshot(repoPath)
    await gitFor(repoPath).reset([`--${mode}`, ref])
  },

  /**
   * One round-trip for the commit context menu: ancestry, remote reachability,
   * reset boundary, in-progress ops, and the full message for amend/undo prefill.
   */
  async commitMenuProbe(repoPath: string, sha: string): Promise<CommitMenuProbe> {
    const [headSha, symbolic, mergeKind, bisect, message, parentLine, remoteContains] = await Promise.all([
      runGit(repoPath, ['rev-parse', 'HEAD']).then((s) => s.trim()).catch(() => ''),
      runGit(repoPath, ['symbolic-ref', '-q', 'HEAD']).then((s) => s.trim()).catch(() => ''),
      gitService.mergeState(repoPath),
      buildBisectStatus(repoPath).then((s) => s.inProgress).catch(() => false),
      gitFor(repoPath).raw(['log', '-1', '--format=%B', sha]).catch(() => ''),
      runGit(repoPath, ['rev-list', '-n', '1', '--parents', sha]).then((s) => s.trim()).catch(() => ''),
      runGit(repoPath, ['branch', '-r', '--contains', sha]).then((s) => s.trim()).catch(() => '')
    ])
    const parentParts = parentLine.split(/\s+/).filter(Boolean)
    const parentSha = parentParts.length > 1 ? parentParts[1] : null
    const isRoot = parentParts.length <= 1
    const fullSha =
      parentParts[0] ||
      (await runGit(repoPath, ['rev-parse', sha]).then((s) => s.trim()).catch(() => sha))
    const isHead = !!headSha && fullSha === headSha
    const isOnLocalBranch = symbolic.startsWith('refs/heads/')
    const isPublished = remoteContains.length > 0
    let isAncestorOfHead = isHead
    if (!isAncestorOfHead && headSha) {
      isAncestorOfHead = await runGit(repoPath, ['merge-base', '--is-ancestor', sha, 'HEAD'])
        .then(() => true)
        .catch(() => false)
    }
    const localRaw = await runGit(repoPath, ['rev-list', 'HEAD', '--not', '--remotes']).catch(() => '')
    const localSet = new Set(localRaw.split('\n').map((s) => s.trim()).filter(Boolean))
    let firstPublished: string | null = null
    if (headSha && (localSet.size === 0 || !localSet.has(headSha))) {
      // HEAD itself is published (or there are no remotes producing "local" commits
      // other than walking off the tip). The first published ancestor is HEAD.
      if (!localSet.has(headSha)) firstPublished = headSha
    }
    if (firstPublished === null && headSha && localSet.size > 0) {
      let cur = headSha
      const seen = new Set<string>()
      while (cur && !seen.has(cur)) {
        seen.add(cur)
        if (!localSet.has(cur)) {
          firstPublished = cur
          break
        }
        const line = await runGit(repoPath, ['rev-list', '-n', '1', '--parents', cur]).catch(() => '')
        const next = line.trim().split(/\s+/)[1]
        if (!next) break
        cur = next
      }
    }
    const isWithinResetBoundary =
      isAncestorOfHead &&
      !isHead &&
      (!isPublished || fullSha === firstPublished || sha === firstPublished)
    const branch = isOnLocalBranch ? symbolic.replace(/^refs\/heads\//, '') : ''
    return {
      isHead,
      isOnLocalBranch,
      isPublished,
      isAncestorOfHead,
      isWithinResetBoundary,
      isRoot,
      parentSha,
      operationInProgress: mergeKind !== null || bisect,
      message,
      headSha,
      branch
    }
  },

  /**
   * Undo HEAD with mixed-reset semantics (or a safe unborn-branch path for the
   * root commit). Working-tree changes — including pre-existing WIP — are kept.
   */
  async undoCommit(repoPath: string): Promise<UndoCommitResult> {
    const headSha = (await runGit(repoPath, ['rev-parse', 'HEAD'])).trim()
    const symbolic = await runGit(repoPath, ['symbolic-ref', '-q', 'HEAD']).then((s) => s.trim()).catch(() => '')
    if (!symbolic.startsWith('refs/heads/')) throw new Error('HEAD is detached — check out a branch first.')
    const branch = symbolic.replace(/^refs\/heads\//, '')
    const message = await gitFor(repoPath).raw(['log', '-1', '--format=%B', headSha])
    const parentLine = (await runGit(repoPath, ['rev-list', '-n', '1', '--parents', headSha])).trim()
    const parents = parentLine.split(/\s+/).slice(1)
    const parentSha = parents[0] ?? null
    if (!parentSha) {
      await undoRootCommit(repoPath)
      return { previousSha: headSha, parentSha: null, wasRoot: true, message, branch }
    }
    await gitFor(repoPath).reset(['--mixed', parentSha])
    return { previousSha: headSha, parentSha, wasRoot: false, message, branch }
  },

  /** Put a branch tip back after undoCommit — unborn-safe. */
  async restoreUndoneCommit(repoPath: string, previousSha: string): Promise<void> {
    await runGit(repoPath, ['update-ref', 'HEAD', previousSha])
    // undoCommit left the index at the parent (or emptied it, for the root
    // commit); realign it with the restored HEAD or status shows the whole
    // commit as staged reversals. Working tree stays untouched.
    await runGit(repoPath, ['reset', '--mixed'])
  },

  async createTag(
    repoPath: string,
    name: string,
    hash?: string,
    opts?: { message?: string; sign?: boolean }
  ): Promise<void> {
    const args: string[] = []
    // A message (or signing) makes it an annotated/signed tag object; otherwise
    // it stays a lightweight tag (just a ref).
    if (opts?.sign) args.push('-s')
    else if (opts?.message) args.push('-a')
    if (opts?.message) args.push('-m', opts.message)
    args.push(name)
    if (hash) args.push(hash)
    await gitFor(repoPath).tag(args)
  },

  async deleteTag(repoPath: string, name: string): Promise<void> {
    await gitFor(repoPath).tag(['-d', name])
  },

  async pushTag(repoPath: string, name: string, remote = 'origin'): Promise<void> {
    await withRemoteAuth(repoPath, remote, 'push', () => runGit(repoPath, ['push', '--', remote, `refs/tags/${name}`]))
  },

  async deleteRemoteTag(repoPath: string, name: string, remote = 'origin'): Promise<void> {
    await withRemoteAuth(repoPath, remote, 'push', () => runGit(repoPath, ['push', '--delete', '--', remote, `refs/tags/${name}`]))
  },

  async getRemoteTags(repoPath: string, remote = 'origin'): Promise<string[]> {
    try {
      // Runs on every repo open, so it must never prompt (runGit sets
      // GIT_TERMINAL_PROMPT=0). A READ method under the shared lock: fine now
      // that withRemoteAuth writes nothing to disk — and the token stays out of
      // the argument list, where it used to go and where `ps` could read it.
      const out = await withRemoteAuth(repoPath, remote, 'fetch', () =>
        runGit(repoPath, ['ls-remote', '--tags', '--refs', '--', remote])
      )
      return out.split('\n').filter(Boolean).map((line) => {
        const ref = line.split('\t')[1] ?? ''
        return ref.replace('refs/tags/', '')
      })
    } catch {
      return []
    }
  },

  // ─── Diffs ─────────────────────────────────────────────────────────────────

  async diffFile(repoPath: string, file: string, staged: boolean, untracked: boolean, ignoreWs = false): Promise<string> {
    const git = gitFor(repoPath)
    const ws = ignoreWs ? ['-w'] : []
    if (untracked) {
      try {
        const content = await readFile(`${repoPath}/${file}`, 'utf-8')
        const lines = content.split('\n')
        return [
          `diff --git a/${file} b/${file}`,
          'new file',
          `--- /dev/null`,
          `+++ b/${file}`,
          `@@ -0,0 +1,${lines.length} @@`,
          ...lines.map((l) => `+${l}`)
        ].join('\n')
      } catch {
        return ''
      }
    }
    return git.raw(staged ? ['diff', ...DIFF_PREFIXES, '--cached', ...ws, '--', file] : ['diff', ...DIFF_PREFIXES, ...ws, '--', file])
  },

  async commitFiles(repoPath: string, hash: string): Promise<FileEntry[]> {
    return memo(commitFilesCache, `${repoPath}\0${hash}`, async () => {
      const git = gitFor(repoPath)
      // -M: detect renames so moved files report R (with old→new paths) instead
      // of an unrelated A/D pair. diff-tree is plumbing and ignores diff.renames.
      const out = await git.raw(['diff-tree', '--no-commit-id', '--name-status', '-M', '-r', '--root', '-m', '--first-parent', hash])
      const seen = new Set<string>()
      const files: FileEntry[] = []
      for (const line of out.split('\n').filter(Boolean)) {
        const [code, ...rest] = line.split('\t')
        const path = rest[rest.length - 1]
        if (!path || seen.has(path)) continue
        seen.add(path)
        files.push({ path, status: mapStatusCode(code[0]) })
      }
      return files
    })
  },

  async commitFileDiff(repoPath: string, hash: string, file: string, ignoreWs = false): Promise<string> {
    // `--first-parent` so merge commits diff against their first parent (matching
    // `commitFiles`). Without it, `git show` falls back to a combined diff (--cc)
    // that's empty for files which only changed on the merged-in branch — the
    // "No changes to display" bug.
    return memo(commitDiffCache, `f\0${repoPath}\0${hash}\0${ignoreWs ? 1 : 0}\0${file}`, () =>
      gitFor(repoPath).raw(['show', ...DIFF_PREFIXES, '--format=', '--first-parent', ...(ignoreWs ? ['-w'] : []), hash, '--', file])
    )
  },

  /**
   * Semantic diff of one file between two versions — renames, signature
   * changes, moves and per-symbol edits instead of raw +/- lines. Read-only:
   * both sides come out of the object database (or the working tree copy).
   */
  async semanticDiff(repoPath: string, file: string, oldSide: BlobSpec, newSide: BlobSpec): Promise<SemanticDiff> {
    const read = async (spec: BlobSpec): Promise<string> => {
      if (spec.kind === 'empty') return ''
      if (spec.kind === 'worktree') return readFile(join(repoPath, file), 'utf-8').catch(() => '')
      // `:file` is the staged copy; `<ref>:file` any committed one. A path that
      // doesn't exist on that side (added/deleted file) reads as empty.
      const rev = spec.kind === 'index' ? `:${file}` : `${spec.ref}:${file}`
      return gitFor(repoPath)
        .raw(['show', rev])
        .catch(() => '')
    }
    const [oldText, newText] = await Promise.all([read(oldSide), read(newSide)])
    if (!oldText && !newText) return { language: null, changes: [] }
    return semanticCompare(file, oldText, newText)
  },

  /**
   * The whole history as one flat stream of "commit + the files it touched",
   * oldest first — the input for the timelapse animation.
   *
   * One `git log` does the lot: asking per commit would be hundreds of
   * processes for a repo worth watching.
   */
  async timelapseData(repoPath: string, max = 2000): Promise<TimelapseCommit[]> {
    const out = await runGit(repoPath, [
      'log',
      '--reverse',
      '--first-parent',
      `--max-count=${max}`,
      '--name-status',
      '-M',
      '--date=unix',
      `--format=${REC}%H${SEP}%an${SEP}%ct${SEP}%s`
    ]).catch(() => '')

    const commits: TimelapseCommit[] = []
    for (const chunk of out.split(REC)) {
      if (!chunk.trim()) continue
      const [head, ...rest] = chunk.split('\n')
      const [hash, author, date, subject] = head.split(SEP)
      if (!hash) continue
      const files: { path: string; status: FileChangeKind }[] = []
      for (const line of rest) {
        if (!line.trim()) continue
        const parts = line.split('\t')
        const path = parts[parts.length - 1]
        if (!path) continue
        files.push({ path, status: mapStatusCode(parts[0][0]) })
      }
      commits.push({ hash, author: author ?? '', date: Number(date) || 0, subject: subject ?? '', files })
    }
    return commits
  },

  async stashFiles(repoPath: string, sha: string, untrackedSha?: string | null): Promise<FileEntry[]> {
    const git = gitFor(repoPath)
    const out = await git.raw(['diff', '--name-status', '-M', `${sha}^1`, sha])
    const files: FileEntry[] = []
    for (const line of out.split('\n').filter(Boolean)) {
      const [code, ...rest] = line.split('\t')
      const path = rest[rest.length - 1]
      if (path) files.push({ path, status: mapStatusCode(code[0]) })
    }
    if (untrackedSha) {
      try {
        const u = await git.raw(['ls-tree', '-r', '--name-only', untrackedSha])
        for (const path of u.split('\n').filter(Boolean)) {
          files.push({ path, status: '?', untracked: true })
        }
      } catch {
        /* untracked tree unavailable */
      }
    }
    return files
  },

  async stashFileDiff(repoPath: string, sha: string, file: string, untracked?: boolean, ignoreWs = false): Promise<string> {
    const git = gitFor(repoPath)
    const ws = ignoreWs ? ['-w'] : []
    if (untracked) {
      return git.raw(['diff-tree', ...DIFF_PREFIXES, '--root', '--no-commit-id', '-p', ...ws, `${sha}^3`, '--', file])
    }
    return git.raw(['diff', ...DIFF_PREFIXES, ...ws, `${sha}^1`, sha, '--', file])
  },

  async stagedDiff(repoPath: string): Promise<string> {
    return gitFor(repoPath).raw(['diff', ...DIFF_PREFIXES, '--cached'])
  },

  /** Full patch of a single commit (vs its first parent; root commit shows full tree). */
  async commitDiff(repoPath: string, hash: string): Promise<string> {
    return memo(commitDiffCache, `d\0${repoPath}\0${hash}`, () =>
      gitFor(repoPath).raw(['show', ...DIFF_PREFIXES, '--format=', '--first-parent', hash])
    )
  },

  /** Branches whose history contains this commit, grouped like the graph's ref
   *  badges: a local branch and its remote-tracking counterpart collapse into
   *  one entry so `main` + `origin/main` render as a single badge. */
  async commitBranches(repoPath: string, hash: string): Promise<CommitBranchInfo[]> {
    const git = gitFor(repoPath)
    const remoteNames = new Set((await git.getRemotes()).map((r) => r.name))
    // Full refname (not :short) so a remote's symbolic HEAD — refs/remotes/origin/HEAD,
    // which :short collapses to the bare string "origin" — can be told apart from an
    // actual local branch literally named "origin".
    const out = await git.raw(['branch', '-a', '--contains', hash, '--format=%(refname)']).catch(() => '')
    const map = new Map<string, CommitBranchInfo>()
    const entry = (name: string): CommitBranchInfo => {
      let g = map.get(name)
      if (!g) {
        g = { name, isLocal: false, remotes: [] }
        map.set(name, g)
      }
      return g
    }
    for (const line of out.split('\n').map((l) => l.trim()).filter(Boolean)) {
      if (line.startsWith('refs/heads/')) {
        entry(line.slice('refs/heads/'.length)).isLocal = true
      } else if (line.startsWith('refs/remotes/')) {
        const rest = line.slice('refs/remotes/'.length)
        const slash = rest.indexOf('/')
        if (slash <= 0) continue
        const remote = rest.slice(0, slash)
        const name = rest.slice(slash + 1)
        if (name === 'HEAD' || !remoteNames.has(remote)) continue // origin's symbolic default-branch pointer, not a real branch
        const g = entry(name)
        if (!g.remotes.includes(remote)) g.remotes.push(remote)
      }
    }
    return [...map.values()].sort((a, b) => Number(b.isLocal) - Number(a.isLocal) || a.name.localeCompare(b.name))
  },

  /** Tags that point exactly at this commit. */
  async commitTags(repoPath: string, hash: string): Promise<string[]> {
    const out = await gitFor(repoPath).raw(['tag', '--points-at', hash]).catch(() => '')
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  },

  // ─── File inspection (file view / blame / history) ──────────────────────

  async fileContent(repoPath: string, file: string, ref?: string, force = false): Promise<string> {
    if (!force) await assertUnderCap(repoPath, file, ref, TEXT_MAX_BYTES)
    if (!ref) {
      // Working-tree read; empty if the file was deleted on disk.
      return readFile(join(repoPath, file), 'utf-8').catch(() => '')
    }
    try {
      return await gitFor(repoPath).raw(['show', `${ref}:${file}`])
    } catch {
      // The ref view may be missing — e.g. a staged deletion isn't in the index
      // (':0'). Fall back to the on-disk copy, then the last committed version,
      // so File view shows something instead of a fatal error.
      const onDisk = await readFile(join(repoPath, file), 'utf-8').catch(() => null)
      if (onDisk !== null) return onDisk
      return gitFor(repoPath).raw(['show', `HEAD:${file}`]).catch(() => '')
    }
  },

  /**
   * Filter the given changed-file paths down to those whose working-tree content
   * matches `query`. Used by the commit panel's search bar. Reads files directly
   * (only the handful of changed files), so it covers tracked + untracked alike.
   * Returns `files` unchanged when the query is empty; `[]` for an invalid regex.
   */
  async searchFileContents(
    repoPath: string,
    files: string[],
    query: string,
    opts?: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }
  ): Promise<string[]> {
    if (!query) return files
    let pattern: RegExp
    try {
      const src = opts?.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const body = opts?.wholeWord ? `\\b${src}\\b` : src
      pattern = new RegExp(body, opts?.caseSensitive ? '' : 'i')
    } catch {
      return []
    }
    const matched = await Promise.all(
      files.map(async (f) => {
        try {
          const content = await readFile(join(repoPath, f), 'utf-8')
          return pattern.test(content) ? f : null
        } catch {
          return null // binary, deleted, or unreadable
        }
      })
    )
    return matched.filter((f): f is string => f !== null)
  },

  /**
   * Like `searchFileContents`, but returns every matching LINE (file/line/text)
   * instead of only the file paths — the data a VSCode-style expandable results
   * tree needs. Reads the working-tree copy of each candidate, so it covers
   * tracked, staged and untracked files alike.
   *
   * Capped twice: `maxPerFile` keeps one huge file from burying the rest, `max`
   * bounds the whole payload crossing IPC.
   */
  searchFileMatches(
    repoPath: string,
    files: string[],
    query: string,
    opts?: FileSearchOptions
  ): Promise<CodeSearchHit[]> {
    return searchFileMatches(repoPath, files, query, opts)
  },

  /**
   * Same line-level search, but against the tree of a commit/stash (`rev`)
   * instead of the working tree — `git grep <pattern> <rev> -- <paths>`.
   * Output rows are `rev:path:line:text`, so the rev prefix is stripped off.
   */
  async searchCommitMatches(
    repoPath: string,
    rev: string,
    query: string,
    opts?: {
      paths?: string[]
      caseSensitive?: boolean
      wholeWord?: boolean
      regex?: boolean
      max?: number
      maxPerFile?: number
    }
  ): Promise<CodeSearchHit[]> {
    if (!query.trim()) return []
    const max = opts?.max ?? 2000
    const maxPerFile = opts?.maxPerFile ?? 100
    const args = ['grep', '-n', '-I', '--no-color', '--full-name']
    if (!opts?.caseSensitive) args.push('-i')
    if (opts?.wholeWord) args.push('-w')
    args.push(opts?.regex ? '-E' : '-F')
    args.push('-e', query, rev, '--', ...(opts?.paths ?? []))
    let raw = ''
    try {
      raw = await gitFor(repoPath).raw(args)
    } catch {
      return [] // no matches (exit 1) or invalid pattern
    }
    const hits: CodeSearchHit[] = []
    const perFile = new Map<string, number>()
    const prefix = `${rev}:`
    for (const line of raw.split('\n')) {
      if (!line || hits.length >= max) break
      const body = line.startsWith(prefix) ? line.slice(prefix.length) : line
      const m = /^(.*?):(\d+):(.*)$/.exec(body)
      if (!m) continue
      const file = m[1]
      const seen = perFile.get(file) ?? 0
      if (seen >= maxPerFile) continue
      perFile.set(file, seen + 1)
      hits.push({ file, line: Number(m[2]), text: m[3].slice(0, 400) })
    }
    return hits
  },

  /**
   * Working-tree code search via `git grep -n` (tracked + untracked, honouring
   * .gitignore). Returns up to `max` file:line:text hits. git grep exits 1 when
   * nothing matches, which simple-git throws on — that's a clean empty result.
   */
  async grepWorkingTree(
    repoPath: string,
    query: string,
    opts?: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean; max?: number }
  ): Promise<CodeSearchHit[]> {
    if (!query.trim()) return []
    const max = opts?.max ?? 500
    const args = ['grep', '-n', '-I', '--no-color', '--untracked', '--full-name']
    if (!opts?.caseSensitive) args.push('-i')
    if (opts?.wholeWord) args.push('-w')
    args.push(opts?.regex ? '-E' : '-F')
    args.push('-e', query, '--')
    let raw = ''
    try {
      raw = await gitFor(repoPath).raw(args)
    } catch {
      return [] // no matches (exit 1) or invalid pattern
    }
    const hits: CodeSearchHit[] = []
    for (const line of raw.split('\n')) {
      if (!line) continue
      const m = /^(.*?):(\d+):(.*)$/.exec(line)
      if (!m) continue
      hits.push({ file: m[1], line: Number(m[2]), text: m[3].slice(0, 400) })
      if (hits.length >= max) break
    }
    return hits
  },

  /**
   * History pickaxe: commits that changed the number of occurrences of `query`
   * (`-S`, literal) or whose diff matches it (`-G`, regex). The "who introduced
   * / removed this string" search.
   */
  async searchHistory(
    repoPath: string,
    query: string,
    opts?: { caseSensitive?: boolean; regex?: boolean; max?: number }
  ): Promise<HistorySearchHit[]> {
    if (!query.trim()) return []
    const max = opts?.max ?? 200
    const args = [
      'log',
      `--max-count=${max}`,
      `--pretty=format:%H${SEP}%an${SEP}%at${SEP}%s${REC}`
    ]
    if (!opts?.caseSensitive) args.push('--regexp-ignore-case')
    args.push(opts?.regex ? `-G${query}` : `-S${query}`)
    let raw = ''
    try {
      raw = await gitFor(repoPath).raw(args)
    } catch {
      return []
    }
    return raw
      .split(REC)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((rec) => {
        const [hash, author, date, subject] = rec.split(SEP)
        return { hash, author, date: Number(date), subject }
      })
  },

  async fileDataUrl(repoPath: string, file: string, ref?: string, force = false): Promise<string> {
    if (!force) await assertUnderCap(repoPath, file, ref, PREVIEW_MAX_BYTES)
    const url = await readFileDataUrl(repoPath, file, ref)
    if (url === null) throw new Error(`Cannot read image: ${file}`)
    return url
  },

  /**
   * A repository's tab image as a data URL. Null — never a throw — when the
   * path is missing, escapes the repository (a symlink included), is not an
   * image, or is too large for a tab icon: that null is the "broken path" the
   * repository settings warn about, and a tab simply falls back to the name.
   */
  async repoImage(repoPath: string, file: string): Promise<string | null> {
    if (!file || isAbsolute(file) || !fileMime(file).startsWith('image/')) return null
    try {
      const root = await realpath(repoPath)
      const target = await realpath(join(repoPath, file))
      if (!target.startsWith(root + sep)) return null
      const info = await stat(target)
      if (!info.isFile() || info.size > REPO_IMAGE_MAX_BYTES) return null
      return `data:${fileMime(file)};base64,${(await readFile(target)).toString('base64')}`
    } catch {
      return null
    }
  },

  async imageDiff(
    repoPath: string,
    file: string,
    beforeRef: string | null,
    afterRef?: string
  ): Promise<{ before: string | null; after: string | null }> {
    const [before, after] = await Promise.all([
      beforeRef == null ? Promise.resolve(null) : readFileDataUrl(repoPath, file, beforeRef),
      readFileDataUrl(repoPath, file, afterRef)
    ])
    return { before, after }
  },

  async blameFile(repoPath: string, file: string, ref?: string): Promise<BlameLine[]> {
    const args = ['blame', '--line-porcelain']
    if (ref) args.push(ref)
    args.push('--', file)
    const out = await gitFor(repoPath).raw(args)
    const result: BlameLine[] = []
    let sha = ''
    let author = ''
    let date = 0
    let lineNo = 1
    for (const l of out.split('\n')) {
      if (/^[0-9a-f]{40} /.test(l)) sha = l.slice(0, 40)
      else if (l.startsWith('author ')) author = l.slice(7)
      else if (l.startsWith('author-time ')) date = +l.slice(12)
      else if (l.startsWith('\t')) result.push({ sha, author, date, lineNo: lineNo++, text: l.slice(1) })
    }
    return result
  },

  async fileHistory(repoPath: string, file: string): Promise<FileHistoryEntry[]> {
    const out = await gitFor(repoPath).raw([
      'log',
      '--follow',
      '--max-count=200',
      `--pretty=format:%H${SEP}%an${SEP}%at${SEP}%s`,
      '--',
      file
    ])
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, author, date, subject] = line.split(SEP)
        return { hash, author, date: +date, subject }
      })
  },

  // ─── Worktrees ───────────────────────────────────────────────────────────

  async worktrees(repoPath: string): Promise<WorktreeInfo[]> {
    const out = await gitFor(repoPath).raw(['worktree', 'list', '--porcelain']).catch(() => '')
    const result: WorktreeInfo[] = []
    let cur: Partial<WorktreeInfo> | null = null
    const flush = (): void => {
      if (cur && cur.path) {
        result.push({
          path: cur.path,
          branch: cur.branch ?? null,
          head: cur.head ?? '',
          isMain: false,
          isCurrent: false,
          locked: cur.locked ?? false,
          lockReason: cur.lockReason ?? null,
          detached: cur.detached ?? false,
          prunable: cur.prunable ?? false
        })
      }
      cur = null
    }
    for (const line of out.split('\n')) {
      if (line.startsWith('worktree ')) {
        flush()
        cur = { path: line.slice('worktree '.length).trim() }
      } else if (!cur) {
        continue
      } else if (line.startsWith('HEAD ')) {
        cur.head = line.slice('HEAD '.length).trim()
      } else if (line.startsWith('branch ')) {
        cur.branch = line.slice('branch '.length).trim().replace('refs/heads/', '')
      } else if (line === 'detached') {
        cur.detached = true
      } else if (line === 'locked' || line.startsWith('locked ')) {
        cur.locked = true
        // `locked <reason>` — the reason is the only hint of *why* (a USB
        // drive, a network share), so it is kept for the row's tooltip.
        cur.lockReason = line.slice('locked'.length).trim() || null
      } else if (line === 'prunable' || line.startsWith('prunable ')) {
        // The folder is gone (deleted or moved by hand); only the record is left.
        cur.prunable = true
      }
    }
    flush()
    const normalizedRepo = repoPath.replace(/\/+$/, '')
    if (result.length) result[0].isMain = true
    for (const w of result) {
      if (w.path.replace(/\/+$/, '') === normalizedRepo) w.isCurrent = true
    }
    return result
  },

  /** Main-worktree path of the repository `repoPath` belongs to. The main
   *  worktree itself returns its own path; a linked worktree returns the
   *  root's path; a non-repository returns null. One `rev-parse`, used by the
   *  header to offer grouping worktrees that share a root. */
  async worktreeRoot(repoPath: string): Promise<string | null> {
    const out = await gitFor(repoPath)
      .raw(['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'])
      .catch(() => '')
    const [gitDir, common] = out.trim().split('\n').map((l) => l.trim())
    if (!gitDir || !common) return null
    // Not a linked worktree: the repository is its own root. Answered as the
    // path asked about, not git's resolved one — callers compare the two, and
    // a repository opened through a symlinked folder must not look like a
    // worktree of its own real path. Both dirs come back resolved alike, so
    // comparing them is safe where comparing them to `repoPath` is not.
    if (gitDir === common) return repoPath
    // A linked worktree: the main checkout is git's first worktree entry, not
    // `dirname(common)` — that is `.git/modules` for a submodule's worktree and
    // the bare repository's parent for a bare one. A bare repository has no
    // main checkout to point at, so it answers null rather than a folder that
    // is not a repository.
    const list = await gitFor(repoPath)
      .raw(['worktree', 'list', '--porcelain'])
      .catch(() => '')
    const first = list.split('\n\n')[0]?.split('\n') ?? []
    const main = first.find((l) => l.startsWith('worktree '))?.slice('worktree '.length).trim()
    if (!main || first.includes('bare')) return null
    // A submodule's first entry is its git dir (`.git/modules/x`): its working
    // folder is `core.worktree`, relative to that dir. None means no checkout.
    if (main === common) {
      const wt = await gitFor(repoPath)
        .raw(['config', '--file', join(common, 'config'), '--get', 'core.worktree'])
        .catch(() => '')
      return wt.trim() ? resolvePath(common, wt.trim()) : null
    }
    return main
  },

  async worktreeAdd(
    repoPath: string,
    path: string,
    branch: string,
    newBranch: boolean,
    startPoint?: string
  ): Promise<void> {
    // git's own "already exists" fatal is terse; refuse an occupied target
    // first with a message that names the problem. An existing empty folder
    // is still fine — `git worktree add` accepts it.
    const target = isAbsolute(path) ? path : resolvePath(repoPath, path)
    const existing = await readdir(target).catch(() => null)
    if (existing && existing.length > 0) {
      throw new Error(`Worktree folder is not empty: ${path}`)
    }
    const args = ['worktree', 'add']
    if (newBranch) {
      args.push('-b', branch, path)
      if (startPoint) args.push(startPoint)
    } else {
      args.push(path, branch)
    }
    await gitFor(repoPath).raw(args)
    await makeWorktreeGitfilePortable(target)
    // One settings read for both opt-ins — readSettings touches disk each
    // call and this sits on the create path the user is waiting on.
    const settings = await readSettings()
    // Ignored files don't travel with git — .env has to be copied by hand
    // otherwise. Opt-in via the add-worktree dialog.
    if (settings.worktreeCopyIgnored === true) {
      await copyIgnoredIntoWorktree(repoPath, target).catch(() => undefined)
    }
    // A worktree is a fresh project root — the parent's .codegraph index does
    // not carry over, so agents opening it find nothing. When the parent is
    // indexed and the CLI is on PATH, index the new tree in the background.
    // Opt-in only (Settings, or the add-worktree dialog): it runs a third-party CLI.
    if (
      settings.codegraphIndexWorktrees === true &&
      existsSync(resolvePath(repoPath, '.codegraph')) &&
      !existsSync(resolvePath(target, '.codegraph')) &&
      hasBinary('codegraph')
    ) {
      indexCodegraphAsync(target, true)
    }
  },

  async worktreeRemove(repoPath: string, path: string, force: boolean): Promise<void> {
    const args = ['worktree', 'remove']
    if (force) args.push('--force')
    args.push(path)
    await gitFor(repoPath).raw(args)
  },

  /**
   * What removing a worktree would cost: uncommitted changes, and commits its
   * branch has that the upstream does not. Null when the folder is gone.
   * Read on demand (opening the section, before a remove) — never per refresh,
   * because it spawns one `git status` inside every linked worktree.
   */
  // `_repoPath` is unused here but stays first: the dispatcher locks on args[0].
  async getWorktreeStatus(_repoPath: string, worktreePath: string): Promise<WorktreeStatus | null> {
    if (!existsSync(worktreePath)) return null
    // Status is per checkout, so it has to run inside the worktree itself.
    const out = await runGit(worktreePath, ['status', '--porcelain=v2', '--branch']).catch(() => null)
    if (out === null) return null
    let changes = 0
    let ahead = 0
    let behind = 0
    let upstream: string | null = null
    for (const line of out.split('\n')) {
      if (!line) continue
      if (line.startsWith('# branch.upstream ')) upstream = line.slice('# branch.upstream '.length).trim()
      else if (line.startsWith('# branch.ab ')) {
        const m = /\+(\d+) -(\d+)/.exec(line)
        if (m) {
          ahead = +m[1]
          behind = +m[2]
        }
      } else if (!line.startsWith('#')) changes++
    }
    return { changes, ahead, behind, upstream }
  },

  /** Keep `git worktree prune` (and other clients) from discarding a worktree
   *  whose folder is temporarily unreachable — a USB drive, a network share. */
  async worktreeLock(repoPath: string, worktreePath: string, reason?: string): Promise<void> {
    const args = ['worktree', 'lock']
    if (reason?.trim()) args.push('--reason', reason.trim())
    args.push(worktreePath)
    await runGit(repoPath, args)
  },

  async worktreeUnlock(repoPath: string, worktreePath: string): Promise<void> {
    await runGit(repoPath, ['worktree', 'unlock', worktreePath])
  },

  /**
   * Forget worktrees whose folder no longer exists. Only git's bookkeeping in
   * `.git/worktrees/` goes — there is no folder left to delete — and locked
   * worktrees are skipped by git itself. Returns how many were forgotten.
   */
  async worktreePrune(repoPath: string): Promise<number> {
    // `prune --verbose` reports on stderr, which runGit does not return, so
    // count the records before and after instead of parsing its chatter.
    const before = (await gitService.worktrees(repoPath)).length
    await runGit(repoPath, ['worktree', 'prune'])
    return before - (await gitService.worktrees(repoPath)).length
  },

  /** Move a worktree's folder and update both sides of the link. Git refuses a
   *  locked worktree and the main one; the UI does not offer either. */
  async worktreeMove(repoPath: string, from: string, to: string): Promise<void> {
    const target = isAbsolute(to) ? to : resolvePath(repoPath, to)
    // Same courtesy as worktreeAdd: name the problem instead of git's terse fatal.
    if (existsSync(target)) throw new Error(`Worktree destination already exists: ${to}`)
    // git renames the folder but will not create the parent it lands in.
    await mkdir(dirname(target), { recursive: true })
    await runGit(repoPath, ['worktree', 'move', from, target])
    // `move` rewrites the `.git` file with an absolute path again.
    await makeWorktreeGitfilePortable(target)
  },

  /**
   * Re-link a worktree whose folder was moved by hand. Run from the main
   * repository with the folder's new location, git rewrites both pointers.
   */
  async worktreeRepair(repoPath: string, newPath: string): Promise<void> {
    const target = isAbsolute(newPath) ? newPath : resolvePath(repoPath, newPath)
    if (!existsSync(join(target, '.git'))) throw new Error(`Not a worktree folder: ${newPath}`)
    await runGit(repoPath, ['worktree', 'repair', target])
    await makeWorktreeGitfilePortable(target)
  },

  // ─── Submodules ──────────────────────────────────────────────────────────

  async submodules(repoPath: string): Promise<SubmoduleInfo[]> {
    const git = gitFor(repoPath)
    // `.gitmodules` is the source of truth for registered submodules; without it
    // there is nothing to show (and `git submodule status` would print nothing).
    const config = await git.raw(['config', '--file', '.gitmodules', '--list']).catch(() => '')
    if (!config.trim()) return []

    // name → { path, url, branch }, built from `submodule.<name>.<key>=<value>`.
    const meta = new Map<string, { path?: string; url?: string; branch?: string }>()
    for (const line of config.split('\n').filter(Boolean)) {
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const key = line.slice(0, eq)
      const value = line.slice(eq + 1)
      const m = /^submodule\.(.+)\.(path|url|branch)$/.exec(key)
      if (!m) continue
      const entry = meta.get(m[1]) ?? {}
      entry[m[2] as 'path' | 'url' | 'branch'] = value
      meta.set(m[1], entry)
    }

    // `git submodule status` reports the live state. The leading char encodes
    // status, followed by the SHA, the path, and an optional `(describe)`.
    const statusOut = await git.raw(['submodule', 'status']).catch(() => '')
    const statusByPath = new Map<string, { sha: string; status: SubmoduleStatus; describe: string | null }>()
    for (const line of statusOut.split('\n').filter(Boolean)) {
      const m = /^([ +\-U])([0-9a-f]{7,40})\s+(.+?)(?:\s+\((.+)\))?$/.exec(line)
      if (!m) continue
      const flag = m[1]
      const status: SubmoduleStatus =
        flag === '+' ? 'modified' : flag === '-' ? 'uninitialized' : flag === 'U' ? 'conflict' : 'initialized'
      statusByPath.set(m[3], { sha: m[2], status, describe: m[4] ?? null })
    }

    // The commit each submodule is *pinned* to lives as a gitlink (mode 160000)
    // in the superproject's HEAD tree. Used to measure drift for modified ones.
    const recordedByPath = new Map<string, string>()
    const tree = await git.raw(['ls-tree', '-r', 'HEAD']).catch(() => '')
    for (const line of tree.split('\n').filter(Boolean)) {
      const m = /^160000 commit ([0-9a-f]{40})\t(.+)$/.exec(line)
      if (m) recordedByPath.set(m[2], m[1])
    }

    const result: SubmoduleInfo[] = []
    for (const [name, info] of meta) {
      if (!info.path) continue
      const st = statusByPath.get(info.path)
      const recordedSha = recordedByPath.get(info.path) ?? ''
      let ahead = 0
      let behind = 0
      // For a checked-out submodule sitting off its recorded commit, count the
      // divergence so the UI can render an out-of-sync "↑n / ↓n" indicator.
      if (st?.status === 'modified' && recordedSha && st.sha && recordedSha !== st.sha) {
        const counts = await gitFor(join(repoPath, info.path))
          .raw(['rev-list', '--left-right', '--count', `${recordedSha}...${st.sha}`])
          .catch(() => '')
        const parts = counts.trim().split(/\s+/)
        if (parts.length === 2) {
          behind = Number(parts[0]) || 0
          ahead = Number(parts[1]) || 0
        }
      }
      result.push({
        name,
        path: info.path,
        url: info.url ?? '',
        branch: info.branch ?? null,
        sha: st?.sha ?? '',
        recordedSha,
        describe: st?.describe ?? null,
        status: st?.status ?? 'uninitialized',
        ahead,
        behind
      })
    }
    result.sort((a, b) => a.path.localeCompare(b.path))
    return result
  },

  async submoduleAdd(repoPath: string, url: string, path: string, branch?: string): Promise<void> {
    assertNotOption(url, 'the submodule URL')
    assertNotOption(branch, 'the branch')
    const args = ['submodule', 'add']
    if (branch) args.push('-b', branch)
    args.push('--', url, path)
    await gitFor(repoPath).raw(args)
  },

  /** Update a submodule's remote URL in `.gitmodules` and sync the live config. */
  async submoduleSetUrl(repoPath: string, name: string, url: string): Promise<void> {
    assertNotOption(url, 'the submodule URL')
    const git = gitFor(repoPath)
    await git.raw(['config', '--file', '.gitmodules', `submodule.${name}.url`, url])
    await git.raw(['submodule', 'sync', '--', name]).catch(() => '')
  },

  async submoduleUpdate(repoPath: string, path?: string, init = true): Promise<void> {
    const args = ['submodule', 'update']
    if (init) args.push('--init')
    args.push('--recursive')
    if (path) args.push('--', path)
    await gitFor(repoPath).raw(args)
  },

  async submoduleSync(repoPath: string, path?: string): Promise<void> {
    const args = ['submodule', 'sync', '--recursive']
    if (path) args.push('--', path)
    await gitFor(repoPath).raw(args)
  },

  async submoduleDeinit(repoPath: string, path: string, force = false): Promise<void> {
    const args = ['submodule', 'deinit']
    if (force) args.push('--force')
    args.push('--', path)
    await gitFor(repoPath).raw(args)
  },

  /**
   * Fully removes a submodule: deinit, drop the working tree from the index,
   * and strip its `.gitmodules` stanza so it no longer shows up.
   */
  async submoduleRemove(repoPath: string, path: string): Promise<void> {
    const git = gitFor(repoPath)
    await git.raw(['submodule', 'deinit', '--force', '--', path]).catch(() => '')
    await git.raw(['rm', '--force', '--', path]).catch(() => '')
    // `git rm` of a submodule may leave the stale .git metadata behind.
    // Through execFile, not simple-git: no allowConfig pattern can name `submodule.<path>`
    // without also naming `submodule.<path>.update`, which can run a command.
    await runGit(repoPath, ['config', '--remove-section', `submodule.${path}`]).catch(() => '')
  },

  // ─── Config / profiles ─────────────────────────────────────────────────────

  async getUser(repoPath: string): Promise<{ name: string; email: string }> {
    const git = gitFor(repoPath)
    const name = (await git.raw(['config', '--get', 'user.name']).catch(() => '')).trim()
    const email = (await git.raw(['config', '--get', 'user.email']).catch(() => '')).trim()
    return { name, email }
  },

  async setUser(repoPath: string, name: string, email: string): Promise<void> {
    const git = gitFor(repoPath)
    await git.addConfig('user.name', name)
    await git.addConfig('user.email', email)
  },

  /** Branch names a remote advertises, for the clone dialog's branch picker.
   *  Never touches disk — `ls-remote` is a network read with no local repo. */
  async remoteBranches(url: string, host?: string, token?: string, profileId?: string): Promise<string[]> {
    assertNotOption(url, 'the URL')
    const credEnv = await cloneCredentialEnv(url, host, token, profileId)
    try {
      if (credEnv && needsConfigEnv(credEnv)) await assertGitSupportsCredentialEnv()
      // `--` and a neutral cwd: run from inside a repository, a URL git did
      // read as an option would pick up that repository's config and remotes.
      const { stdout } = await pexecFile('git', ['ls-remote', '--heads', '--', url], {
        cwd: tmpdir(),
        env: { ...noPromptEnv(), ...(credEnv ?? {}) }
      })
      return stdout
        .split('\n')
        .map((line) => line.split('\t')[1]?.replace(/^refs\/heads\//, '') ?? '')
        .filter(Boolean)
        .sort()
    } catch (err) {
      const e = err as { stderr?: string; message?: string }
      throw new Error(redactCredentials((e.stderr || e.message || 'git ls-remote failed').trim()))
    } finally {
      releaseCredentialEnv(credEnv)
    }
  },

  async clone(
    parentDir: string,
    url: string,
    name: string,
    opts: CloneOptions = {},
    onProgress?: (p: CloneProgress) => void
  ): Promise<string> {
    assertNotOption(url, 'the URL')
    assertNotOption(opts.branch?.trim(), 'the branch')
    const folder = name.trim() || basename(url).replace(/\.git$/, '') || 'repository'
    // The name may be a hosting server's, so it is checked here, not only in
    // the dialog: one that names a path would clone outside `parentDir`.
    const problem = cloneFolderProblem(folder)
    if (problem) throw new Error(`Refusing the folder name "${folder}": it ${problem}.`)
    const target = join(parentDir, folder)
    const inside = relative(resolvePath(parentDir), resolvePath(target))
    if (!inside || inside.startsWith('..') || isAbsolute(inside)) {
      throw new Error(`Refusing the folder name "${folder}": it resolves outside the chosen folder.`)
    }
    if (existsSync(target)) throw new Error(`A folder named "${folder}" already exists here.`)
    // Registered before the first await, so a cancel sent the moment the clone
    // starts finds it; an abort before git spawns rejects the clone at once.
    const controller = new AbortController()
    if (opts.cloneId) runningClones.set(opts.cloneId, controller)
    let credEnv: NodeJS.ProcessEnv | null = null
    try {
      // `git clone --depth` is silently ignored for a local path — a local clone
      // hardlinks the object store instead of fetching — so a shallow request on
      // a local repository only takes effect through a file:// URL.
      const localShallow =
        !!opts.depth && !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.includes('@') && existsSync(url)
      const cloneUrl = localShallow ? pathToFileURL(resolvePath(url)).href : url
      credEnv = localShallow ? null : await cloneCredentialEnv(url, opts.host, opts.token, opts.profileId)
      if (credEnv && needsConfigEnv(credEnv)) await assertGitSupportsCredentialEnv()
      // Streaming the underlying `git clone --progress` so the UI can show real progress;
      // simpleGit auto-appends --progress when a progress handler is configured.
      const git = cloneGit(
        parentDir,
        { ...noPromptEnv(), ...(credEnv ?? {}) },
        onProgress && ((p) => onProgress({ ...p, cloneId: opts.cloneId })),
        controller.signal
      )
      const args: string[] = []
      // A blob filter (e.g. "blob:none") makes this a partial clone — history without
      // file blobs, fetched on demand. Great for very large repos.
      if (opts.filter) args.push(`--filter=${opts.filter}`)
      // `--depth` implies --single-branch in git, so the flag pair below is not
      // contradictory: asking for full branches back is the case worth spelling out.
      if (opts.depth && opts.depth > 0) args.push(`--depth=${Math.floor(opts.depth)}`)
      if (opts.singleBranch === true) args.push('--single-branch')
      else if (opts.singleBranch === false && opts.depth) args.push('--no-single-branch')
      if (opts.branch?.trim()) args.push('--branch', opts.branch.trim())
      if (opts.recurseSubmodules) args.push('--recurse-submodules')
      try {
        await git.clone(cloneUrl, folder, args.length ? args : undefined)
      } catch (err) {
        if (!controller.signal.aborted) throw err
        // Killed mid-transfer, git leaves a half-written folder behind. It did not
        // exist before this clone (checked above), so nothing of the user's is in it.
        await rm(target, { recursive: true, force: true }).catch(() => undefined)
        throw new Error('Clone cancelled')
      }
      // A shallow local clone went through file:// — point origin back at the path the user gave.
      if (cloneUrl !== url) {
        try {
          await simpleGit(target).remote(['set-url', 'origin', url])
        } catch {
          /* non-fatal */
        }
      }
    } finally {
      if (opts.cloneId) runningClones.delete(opts.cloneId)
      releaseCredentialEnv(credEnv)
    }
    return target
  },

  /** Stop a running clone and remove what it had written. False when it already ended. */
  async cancelClone(cloneId: string): Promise<boolean> {
    const controller = runningClones.get(cloneId)
    if (!controller) return false
    controller.abort()
    return true
  },

  async init(parentDir: string, name: string): Promise<string> {
    const { mkdir } = await import('fs/promises')
    const folder = name.trim() || 'my-repo'
    const target = join(parentDir, folder)
    if (existsSync(target)) throw new Error(`A folder named "${folder}" already exists here.`)
    await mkdir(target, { recursive: true })
    await simpleGit(target).init()
    return target
  },

  /** `git init` in an existing folder the user already opened. */
  async initHere(repoPath: string): Promise<void> {
    await simpleGit(repoPath).init()
  },

  // ─── Interactive rebase ────────────────────────────────────────────────────

  async interactiveRebaseSteps(repoPath: string, base: string): Promise<{ hash: string; subject: string }[]> {
    const out = await gitFor(repoPath)
      .raw(['log', '--reverse', `${base}..HEAD`, `--format=%H${SEP}%s`])
      .catch(() => '')
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf(SEP)
        return { hash: line.slice(0, idx), subject: line.slice(idx + 1) }
      })
  },

  async runInteractiveRebase(repoPath: string, base: string, steps: RebaseStep[]): Promise<void> {
    const tmpTodo = join(tmpdir(), `githuttbr-rebase-${Date.now()}.txt`)
    const lines: string[] = []
    for (const s of steps) {
      if (s.action === 'drop') {
        lines.push(`drop ${s.hash.slice(0, 7)} ${s.subject}`)
      } else if (s.action === 'reword' && s.newMessage) {
        lines.push(`pick ${s.hash.slice(0, 7)} ${s.subject}`)
        const escaped = s.newMessage.replace(/\\/g, '\\\\').replace(/'/g, "'\\''")
        lines.push(`exec git commit --amend -m '${escaped}'`)
      } else {
        lines.push(`${s.action} ${s.hash.slice(0, 7)} ${s.subject}`)
      }
    }
    await writeFile(tmpTodo, lines.join('\n') + '\n', 'utf-8')
    try {
      // Drive the rebase todo via `-c sequence.editor` (copies our generated
      // todo over git's) and silence the commit editor via `-c core.editor`.
      // Use `-c` args rather than `.env()` so simple-git's unsafe guard doesn't
      // scan (and reject) inherited env vars such as PAGER / GIT_ASKPASS.
      await simpleGit(repoPath, { unsafe: { allowUnsafeEditor: true } }).raw([
        '-c',
        `sequence.editor=cp ${JSON.stringify(tmpTodo)}`,
        '-c',
        'core.editor=true',
        'rebase',
        '-i',
        base
      ])
    } finally {
      await unlink(tmpTodo).catch(() => {})
    }
  },

  // ─── Patch staging ─────────────────────────────────────────────────────────

  // ─── Absorb (staged hunks → fixup! commits) ───────────────────────────────

  /**
   * Work out which of your own recent commits each staged hunk belongs to.
   *
   * This is `git absorb`: instead of one lumpy "review fixes" commit, blame
   * tells you the commit that introduced the lines you just touched, and each
   * hunk becomes a `fixup!` for it. Only unpublished commits are candidates —
   * rewriting anything already pushed is not ours to offer.
   */
  async absorbPlan(repoPath: string): Promise<AbsorbPlan> {
    const empty = (reason: AbsorbPlan['reason']): AbsorbPlan => ({
      base: '',
      rangeLabel: '',
      targets: [],
      unmatched: [],
      reason
    })

    // A rebase/merge/cherry-pick in flight owns the index; stay out of it.
    if (await gitService.mergeState(repoPath)) return empty('in-progress')

    const diff = await runGit(repoPath, ['diff', ...DIFF_PREFIXES, '--cached'])
    if (!diff.trim()) return empty('no-staged')

    const range = await absorbCandidates(repoPath)
    if (!range.commits.length) return empty('no-commits')

    const { targets, unmatched } = await attributeHunks(repoPath, diff, range.commits)
    return { base: range.base, rangeLabel: range.label, targets, unmatched }
  },

  /**
   * Turn the plan into real `fixup!` commits, optionally folding them in with
   * an autosquash rebase.
   *
   * The working tree is never touched: only the index and the commits this
   * creates. If any step fails, HEAD and the index are put back exactly as they
   * were, so a half-absorbed state cannot survive.
   */
  async absorbApply(repoPath: string, opts: { rebase?: boolean } = {}): Promise<{ created: number; rebased: boolean }> {
    const plan = await gitService.absorbPlan(repoPath)
    if (!plan.targets.length) return { created: 0, rebased: false }

    const originalHead = (await runGit(repoPath, ['rev-parse', 'HEAD'])).trim()
    const originalDiff = await runGit(repoPath, ['diff', ...DIFF_PREFIXES, '--cached'])
    const files = parsePatch(originalDiff)

    // Oldest target first: each fixup shifts the lines below it, and applying in
    // history order keeps every later patch's context where git expects it.
    const order = [...plan.targets].reverse()

    try {
      // Clear the index (working tree untouched) so each fixup can be staged on
      // its own.
      await runGit(repoPath, ['reset', '-q'])

      for (const target of order) {
        const wanted = new Set(target.hunks.map((h) => `${h.file} ${h.header}`))
        for (const file of files) {
          const hunks = file.hunks.filter((h) => wanted.has(`${file.newPath} ${h.header}`))
          if (!hunks.length) continue
          await gitService.stagePatch(repoPath, buildPatch(file, hunks))
        }
        await pexecFile('git', ['-C', repoPath, 'commit', `--fixup=${target.sha}`], { env: noPromptEnv() })
      }

    } catch (err) {
      // Undo our commits and put the original staged set back. `reset --mixed`
      // never touches the working tree, so the user's edits are safe throughout.
      await runGit(repoPath, ['reset', '-q', '--mixed', originalHead]).catch(() => undefined)
      if (originalDiff.trim()) await gitService.stagePatch(repoPath, originalDiff).catch(() => undefined)
      throw err
    }

    // The rebase runs with a clean index (git refuses otherwise), so whatever
    // blame could not place is re-staged only once the fixups are folded in.
    if (opts.rebase) await gitService.autosquash(repoPath, plan.base, true)

    for (const file of files) {
      const claimed = new Set(
        plan.targets.flatMap((t) => t.hunks.filter((h) => h.file === file.newPath).map((h) => h.header))
      )
      const rest = file.hunks.filter((h) => !claimed.has(h.header))
      // Best effort: the change itself is still in the working tree, so a patch
      // that no longer applies costs the user nothing but a re-stage.
      if (rest.length) await gitService.stagePatch(repoPath, buildPatch(file, rest)).catch(() => undefined)
    }

    return { created: plan.targets.length, rebased: !!opts.rebase }
  },

  async stagePatch(repoPath: string, patch: string): Promise<void> {
    const tmpPatch = join(tmpdir(), `githuttbr-patch-${Date.now()}.patch`)
    await writeFile(tmpPatch, patch, 'utf-8')
    try {
      await gitFor(repoPath).raw(['apply', '--cached', tmpPatch])
    } finally {
      await unlink(tmpPatch).catch(() => {})
    }
  },

  /**
   * Apply a hunk (or a line selection shaped as one) from a diff the user is
   * looking at, to the index or the working tree, forwards or reversed. Every
   * hunk action is one of these:
   *
   *   stage   — unstaged diff,   forwards, index
   *   unstage — staged diff,     reversed, index
   *   discard — unstaged diff,   reversed, working tree
   *   revert  — a commit's diff, reversed, working tree
   *   apply   — a stash's diff,  forwards, working tree
   *
   * Plain `git apply` first. For the working tree it then falls back to a
   * three-way merge (see `mergeHunkIntoFile`): revert and apply cut their patch
   * from history, and the file has often moved on since — a later commit, or
   * edits not yet committed. `git apply --3way` cannot help there, since it
   * refuses any file whose working copy differs from the index.
   *
   * `ignoreWhitespace` is for a patch cut from a diff shown with whitespace
   * ignored (`git diff -w`). Its changed lines are exact, but its context lines
   * may differ from the file in whitespace only, so they are matched loosely
   * (`--ignore-whitespace`). The whitespace-only changes hidden from that view
   * stay where they are — the action does what the visible diff shows.
   *
   * Anything touching the working tree is snapshotted first, so even a change
   * the undo stack has lost track of stays recoverable.
   */
  async applyHunkPatch(
    repoPath: string,
    patch: string,
    target: 'index' | 'worktree',
    reverse: boolean,
    ignoreWhitespace = false
  ): Promise<{ conflicts: number; merge?: string }> {
    if (target === 'worktree') await guardSnapshot(repoPath)
    const tmpPatch = join(tmpdir(), `githuttbr-hunk-${Date.now()}-${Math.random().toString(36).slice(2)}.patch`)
    await writeFile(tmpPatch, patch, 'utf-8')
    try {
      const args = ['apply', '--whitespace=nowarn']
      if (target === 'index') args.push('--cached')
      if (reverse) args.push('--reverse')
      if (ignoreWhitespace) args.push('--ignore-whitespace')
      try {
        await runGit(repoPath, [...args, tmpPatch])
        return { conflicts: 0 }
      } catch (err) {
        if (target !== 'worktree') throw err
        const merged = await mergeHunkIntoFile(repoPath, patch, tmpPatch, reverse, ignoreWhitespace)
        if (!merged) throw err
        return merged
      }
    } finally {
      await unlink(tmpPatch).catch(() => {})
    }
  },

  /**
   * Undo (`'before'`) or redo (`'after'`) a three-way hunk merge by writing back
   * the file exactly as it was on that side. Refuses when the file no longer
   * matches the other side — edited since, or a conflict resolved — rather than
   * overwrite work the undo entry never saw.
   */
  async restoreHunkMerge(repoPath: string, merge: string, side: 'before' | 'after'): Promise<void> {
    const entry = hunkMerges.get(merge)
    if (!entry || entry.repoPath !== repoPath) throw new Error('This merge is no longer remembered, so it cannot be undone.')
    const path = await containedPath(repoPath, entry.file)
    if (!path || !(await lstat(path).catch(() => null))?.isFile()) throw new Error(`${entry.file} is no longer a file in this repository.`)
    const expected = side === 'before' ? entry.after : entry.before
    if (!(await readFile(path)).equals(expected)) {
      throw new Error(`${entry.file} has changed since, so it was left as it is.`)
    }
    await guardSnapshot(repoPath)
    await writeFile(path, side === 'before' ? entry.before : entry.after)
  },

  // ─── Reflog (recovery) ─────────────────────────────────────────────────────

  /**
   * Read `git reflog` for a ref (default HEAD). Each entry is a point history
   * passed through — checkout/reset/amend/rebase all leave a trace, so this is
   * the net for recovering "lost" commits. Restore by checking out, resetting,
   * or branching from an entry's sha via the existing reset/checkout/branch ops.
   */
  async reflog(repoPath: string, ref = 'HEAD', max = 200): Promise<ReflogEntry[]> {
    const git = gitFor(repoPath)
    const out = await git
      .raw(['reflog', 'show', `--max-count=${max}`, `--format=%H${SEP}%gD${SEP}%gs${SEP}%ct${REC}`, ref])
      .catch(() => '')
    return out
      .split(REC)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((rec) => {
        const [sha, selector, action, date] = rec.split(SEP)
        return { sha, selector: selector ?? '', action: action ?? '', date: +date || 0 }
      })
  },

  // ─── Bisect ────────────────────────────────────────────────────────────────

  /** Current bisect state (used when (re)opening the UI mid-session). */
  async bisectStatus(repoPath: string): Promise<BisectStatus> {
    return buildBisectStatus(repoPath)
  },

  /** Begin a bisect session. Caller then marks HEAD good/bad to seed the range. */
  async bisectStart(repoPath: string): Promise<BisectStatus> {
    const out = await gitFor(repoPath).raw(['bisect', 'start']).catch(() => '')
    return buildBisectStatus(repoPath, out)
  },

  /**
   * Mark a commit during bisect. `term` is good/bad/skip; `rev` defaults to the
   * current candidate (HEAD). Git narrows the range and checks out the next
   * commit to test, or reports the first bad commit when done.
   */
  async bisectMark(repoPath: string, term: 'good' | 'bad' | 'skip', rev?: string): Promise<BisectStatus> {
    const args = ['bisect', term]
    if (rev) args.push(rev)
    const out = await gitFor(repoPath).raw(args)
    return buildBisectStatus(repoPath, out)
  },

  /**
   * Hand the whole search to a command: `git bisect run`.
   *
   * git checks out each candidate, runs the command, and reads its **exit
   * code**: 0 means good, 125 means "cannot test this one, skip it", anything
   * else (bar 128+) means bad. That contract is the entire feature — a test
   * suite already speaks it, which is why `git bisect run npm test` finds a
   * regression while you make coffee.
   *
   * Output is streamed to `onOutput` as it arrives, because a bisect that takes
   * ten minutes with a silent window is indistinguishable from a hung one.
   */
  async bisectRunScript(
    repoPath: string,
    command: string,
    onOutput?: (chunk: string) => void
  ): Promise<BisectStatus> {
    const script = command.trim()
    if (!script) throw new Error('Give a command to run at each step.')
    const status = await buildBisectStatus(repoPath)
    if (!status.inProgress) throw new Error('Start a bisect and mark a good and a bad commit first.')

    const shell = process.platform === 'win32' ? 'cmd' : 'sh'
    const shellArgs = process.platform === 'win32' ? ['/c', script] : ['-c', script]
    const child = spawn('git', ['-C', repoPath, 'bisect', 'run', shell, ...shellArgs], { env: noPromptEnv() })
    bisectRuns.set(repoPath, child)

    let out = ''
    const collect = (buf: Buffer): void => {
      const chunk = buf.toString()
      out += chunk
      onOutput?.(chunk)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)

    try {
      await new Promise<void>((resolve) => {
        child.on('error', () => resolve())
        // A non-zero exit is not a failure to report: `bisect run` exits non-zero
        // when the script never returned a usable verdict, and the status built
        // from the repository afterwards says so better than a thrown error.
        child.on('close', () => resolve())
      })
    } finally {
      bisectRuns.delete(repoPath)
    }
    return buildBisectStatus(repoPath, out)
  },

  /** Stop a running `bisect run`. The session itself stays open. */
  async bisectCancel(repoPath: string): Promise<boolean> {
    const child = bisectRuns.get(repoPath)
    if (!child) return false
    child.kill()
    bisectRuns.delete(repoPath)
    return true
  },

  /** End the bisect session and return to the original branch/HEAD. */
  async bisectReset(repoPath: string): Promise<void> {
    await gitFor(repoPath).raw(['bisect', 'reset'])
  },

  // ─── Patches ───────────────────────────────────────────────────────────────

  /** Generate a mailbox-style patch (format-patch) for `count` commits ending at `ref`. */
  async formatPatch(repoPath: string, ref: string, count = 1): Promise<string> {
    return gitFor(repoPath).raw(['format-patch', `-${count}`, ref, '--stdout'])
  },

  /**
   * Apply a patch. `am=true` uses `git am` (applies AND commits, preserving the
   * author/message from a format-patch mailbox); otherwise `git apply` patches
   * the working tree without committing. Both use 3-way merge for better fuzz.
   */
  async applyPatch(repoPath: string, content: string, am = false): Promise<void> {
    const tmp = join(tmpdir(), `githuttbr-apply-${Date.now()}.patch`)
    await writeFile(tmp, content, 'utf-8')
    try {
      await gitFor(repoPath).raw(am ? ['am', '--3way', tmp] : ['apply', '--3way', tmp])
    } finally {
      await unlink(tmp).catch(() => {})
    }
  },

  // ─── Branch comparison ─────────────────────────────────────────────────────

  async compareBranches(repoPath: string, a: string, b: string): Promise<BranchCompareResult> {
    const git = gitFor(repoPath)
    const parseLog = async (range: string): Promise<GraphCommit[]> => {
      const out = await git
        .raw(['log', range, `--pretty=format:%H${SEP}%P${SEP}%an${SEP}%ae${SEP}%at${SEP}%D${SEP}%s${REC}`])
        .catch(() => '')
      return out
        .split(REC)
        .map((r) => r.trim())
        .filter(Boolean)
        .map((rec) => {
          const [hash, parents, author, email, date, refs, subject] = rec.split(SEP)
          return {
            hash,
            parents: parents ? parents.split(' ').filter(Boolean) : [],
            author,
            email,
            date: +date,
            refs: refs ? refs.split(',').map((s) => s.trim()).filter(Boolean) : [],
            subject: subject ?? ''
          }
        })
    }
    const [aheadCommits, behindCommits, diff] = await Promise.all([
      parseLog(`${b}..${a}`),
      parseLog(`${a}..${b}`),
      git.raw(['diff', ...DIFF_PREFIXES, `${b}...${a}`]).catch(() => '')
    ])
    return { aheadCommits, behindCommits, diff }
  },

  /**
   * Bring `refs/remotes/<remote>/<target>` up to date before a pull request is
   * drafted against it. A write — it moves a remote-tracking ref and FETCH_HEAD —
   * so it stays out of READ_METHODS and takes the exclusive lock, and the
   * comparison itself (`prComparison`) is a separate read.
   *
   * Never throws: offline, no access, or a branch the remote does not have all
   * return false, and the caller compares against whatever ref is already there.
   * Short timeout, no prompts — it only exists to make a prefill more accurate.
   */
  async refreshPrBase(repoPath: string, remote: string, target: string): Promise<boolean> {
    try {
      assertNotOption(target, 'the branch')
      await withRemoteAuth(repoPath, remote, 'fetch', () =>
        runGit(repoPath, ['fetch', '--no-tags', '--', remote, target], undefined, undefined, PR_BASE_FETCH_TIMEOUT_MS)
      )
      return true
    } catch {
      return false
    }
  },

  /**
   * What a pull request from `source` into `target` on `remote` would contain.
   * The host compares against its own copy of the target, so this does too:
   * after `git pull <remote> main` was merged into a feature branch while the
   * local `main` stayed behind, a comparison with the local branch would count
   * every upstream commit that came in through the merge. Merge commits are
   * left out as well — the PR's prose is about the user's own work.
   *
   * Falls back to the local `target` when the remote has no tracking ref for
   * it, and says so (`baseIsRemote: false`).
   */
  async prComparison(repoPath: string, source: string, target: string, remote: string): Promise<PrComparison> {
    assertNotOption(source, 'the branch')
    assertNotOption(target, 'the branch')
    assertNotOption(remote, 'the remote')
    const remoteRef = `refs/remotes/${remote}/${target}`
    const hasRemote = await runGit(repoPath, ['rev-parse', '--verify', '--quiet', `${remoteRef}^{commit}`])
      .then(() => true)
      .catch(() => false)
    const base = hasRemote ? remoteRef : target
    const format = `--pretty=format:%H${SEP}%P${SEP}%an${SEP}%ae${SEP}%at${SEP}%D${SEP}%s${REC}`
    // execFile's default 1 MB buffer is small for a long-lived branch's diff.
    const [log, diff] = await Promise.all([
      runGit(repoPath, ['log', '--no-merges', format, `${base}..${source}`, '--'], undefined, 16 << 20).catch(() => ''),
      runGit(repoPath, ['diff', ...DIFF_PREFIXES, `${base}...${source}`, '--'], undefined, 64 << 20).catch(() => '')
    ])
    const commits = log
      .split(REC)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((rec) => {
        const [hash, parents, author, email, date, refs, subject] = rec.split(SEP)
        return {
          hash,
          parents: parents ? parents.split(' ').filter(Boolean) : [],
          author,
          email,
          date: +date,
          refs: refs ? refs.split(',').map((x) => x.trim()).filter(Boolean) : [],
          subject: subject ?? ''
        }
      })
    return { base, baseIsRemote: hasRemote, commits, diff }
  },

  /** Per-day commit counts and author tallies from the repo's history. `sinceDays` 0 = whole history. */
  async repoStats(repoPath: string, sinceDays = 0): Promise<RepoStats> {
    const git = gitFor(repoPath)
    const args = ['log', '--no-merges', `--pretty=format:%at${SEP}%an`]
    if (sinceDays > 0) args.push(`--since=${sinceDays}.days.ago`)
    const out = await git.raw(args).catch(() => '')
    const perDayMap = new Map<string, number>()
    const authorMap = new Map<string, number>()
    let first = 0
    let last = 0
    let totalCommits = 0
    for (const line of out.split('\n')) {
      const [at, ...nameParts] = line.split(SEP)
      const ts = +at
      if (!ts) continue
      const name = nameParts.join(SEP).trim() || 'Unknown'
      totalCommits += 1
      if (!last || ts > last) last = ts
      if (!first || ts < first) first = ts
      const d = new Date(ts * 1000)
      const key = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`
      perDayMap.set(key, (perDayMap.get(key) ?? 0) + 1)
      authorMap.set(name, (authorMap.get(name) ?? 0) + 1)
    }
    const perDay = [...perDayMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const authors = [...authorMap.entries()]
      .map(([name, commits]) => ({ name, commits }))
      .sort((a, b) => b.commits - a.commits)
    return { totalCommits, first, last, perDay, authors }
  },

  /**
   * Rich repository insights from one `git log --numstat` pass: per-file change
   * frequency + churn (hotspots), per-author contribution totals, and a weekly
   * churn timeline. Renames are followed; binary files (numstat "-") count as a
   * touch but contribute no line counts.
   */
  /** Distinct commit authors (name + email), most-frequent first — for the
   *  composer's co-author picker. */
  async contributors(repoPath: string, max = 100): Promise<{ name: string; email: string }[]> {
    const out = await gitFor(repoPath)
      .raw(['log', '--no-merges', '-5000', `--pretty=format:%an${SEP}%ae`])
      .catch(() => '')
    const counts = new Map<string, { name: string; email: string; n: number }>()
    for (const line of out.split('\n')) {
      const [name, email] = line.split(SEP)
      if (!name || !email) continue
      const key = email.toLowerCase()
      const e = counts.get(key)
      if (e) e.n++
      else counts.set(key, { name, email, n: 1 })
    }
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, max).map(({ name, email }) => ({ name, email }))
  },

  async repoInsights(repoPath: string, sinceDays = 0): Promise<RepoInsights> {
    const git = gitFor(repoPath)
    // \x01 prefixes each commit header so it's distinguishable from numstat rows.
    const args = ['log', '--no-merges', '--numstat', '-M', `--pretty=format:\x01%at${SEP}%an`]
    if (sinceDays > 0) args.push(`--since=${sinceDays}.days.ago`)
    const out = await git.raw(args).catch(() => '')

    const authorMap = new Map<string, AuthorStat>()
    const fileMap = new Map<string, FileHotspot>()
    const churnMap = new Map<string, ChurnPoint>()
    let totalCommits = 0
    let first = 0
    let last = 0
    let curAuthor = 'Unknown'
    let curWeek = ''
    let curTs = 0

    // ISO Monday of the week containing `ts` (seconds), as YYYY-MM-DD.
    const weekOf = (ts: number): string => {
      const d = new Date(ts * 1000)
      const day = (d.getUTCDay() + 6) % 7 // 0 = Monday
      d.setUTCDate(d.getUTCDate() - day)
      return `${d.getUTCFullYear()}-${`${d.getUTCMonth() + 1}`.padStart(2, '0')}-${`${d.getUTCDate()}`.padStart(2, '0')}`
    }

    for (const line of out.split('\n')) {
      if (line.startsWith('\x01')) {
        const [at, name] = line.slice(1).split(SEP)
        curTs = +at || 0
        curAuthor = (name ?? '').trim() || 'Unknown'
        curWeek = weekOf(curTs)
        totalCommits += 1
        if (!last || curTs > last) last = curTs
        if (!first || curTs < first) first = curTs
        const a = authorMap.get(curAuthor) ?? { name: curAuthor, commits: 0, added: 0, removed: 0 }
        a.commits += 1
        authorMap.set(curAuthor, a)
        const w = churnMap.get(curWeek) ?? { week: curWeek, added: 0, removed: 0, commits: 0 }
        w.commits += 1
        churnMap.set(curWeek, w)
        continue
      }
      if (!line.trim()) continue
      // numstat row: "<added>\t<removed>\t<path>" ("-" for binary).
      const parts = line.split('\t')
      if (parts.length < 3) continue
      const added = parts[0] === '-' ? 0 : Number(parts[0]) || 0
      const removed = parts[1] === '-' ? 0 : Number(parts[1]) || 0
      // For renames numstat shows "old => new" (or "{a => b}/c"); keep the new path.
      let path = parts.slice(2).join('\t')
      if (path.includes('=>')) {
        path = path.replace(/\{[^}]*=>\s*([^}]*)\}/g, '$1').replace(/.*=>\s*/, '').trim()
      }
      const f = fileMap.get(path) ?? { path, commits: 0, added: 0, removed: 0 }
      f.commits += 1
      f.added += added
      f.removed += removed
      fileMap.set(path, f)
      const a = authorMap.get(curAuthor)
      if (a) {
        a.added += added
        a.removed += removed
      }
      const w = churnMap.get(curWeek)
      if (w) {
        w.added += added
        w.removed += removed
      }
    }

    const authors = [...authorMap.values()].sort((a, b) => b.commits - a.commits)
    const hotspots = [...fileMap.values()].sort((a, b) => b.commits - a.commits).slice(0, 30)
    const churn = [...churnMap.values()].sort((a, b) => a.week.localeCompare(b.week))
    return { totalCommits, first, last, filesTouched: fileMap.size, authors, hotspots, churn }
  },

  /**
   * Per-commit history with touched files, for the "RepoCosmos" 3D visualization
   * easter egg. Same single `git log --numstat` pass as `repoInsights`, but
   * returns per-commit records instead of aggregating — capped to the most
   * recent `limit` commits for render performance.
   */
  async cosmosData(repoPath: string, limit = 2000): Promise<CosmosCommit[]> {
    const git = gitFor(repoPath)
    const args = ['log', '-M', `-${limit}`, `--pretty=format:\x01%H${SEP}%P${SEP}%an${SEP}%ae${SEP}%at${SEP}%s`, '--numstat']
    const out = await git.raw(args).catch(() => '')

    const commits: CosmosCommit[] = []
    let cur: CosmosCommit | null = null

    for (const line of out.split('\n')) {
      if (line.startsWith('\x01')) {
        const [hash, parents, authorName, authorEmail, at, subject] = line.slice(1).split(SEP)
        cur = {
          hash,
          parents: parents ? parents.split(' ').filter(Boolean) : [],
          authorName: (authorName ?? '').trim() || 'Unknown',
          authorEmail: (authorEmail ?? '').trim(),
          timestamp: +at || 0,
          subject: subject ?? '',
          files: []
        }
        commits.push(cur)
        continue
      }
      if (!cur || !line.trim()) continue
      // numstat row: "<added>\t<removed>\t<path>" ("-" for binary).
      const parts = line.split('\t')
      if (parts.length < 3) continue
      const added = parts[0] === '-' ? 0 : Number(parts[0]) || 0
      const removed = parts[1] === '-' ? 0 : Number(parts[1]) || 0
      // For renames numstat shows "old => new" (or "{a => b}/c"); keep the new path.
      let path = parts.slice(2).join('\t')
      if (path.includes('=>')) {
        path = path.replace(/\{[^}]*=>\s*([^}]*)\}/g, '$1').replace(/.*=>\s*/, '').trim()
      }
      cur.files.push({ path, added, removed })
    }

    return commits
  },

  /**
   * Build a Conventional-Commits changelog for the range `from..to` (defaults to
   * the latest tag → HEAD). Commits are parsed as `type(scope)!: subject`,
   * grouped by type with breaking changes surfaced first.
   */
  async generateChangelog(
    repoPath: string,
    opts?: { from?: string; to?: string; version?: string }
  ): Promise<ChangelogResult> {
    const git = gitFor(repoPath)
    const to = opts?.to?.trim() || 'HEAD'
    // Default `from` to the most recent tag reachable from `to`, if any.
    let from = opts?.from?.trim() || ''
    if (!from) from = (await git.raw(['describe', '--tags', '--abbrev=0', to]).catch(() => '')).trim()
    const range = from ? `${from}..${to}` : to

    const raw = await git
      .raw(['log', range, '--no-merges', `--pretty=format:%h${SEP}%s${SEP}%b${REC}`])
      .catch(() => '')

    const GROUPS: { key: string; title: string }[] = [
      { key: 'feat', title: '✨ Features' },
      { key: 'fix', title: '🐛 Bug Fixes' },
      { key: 'perf', title: '⚡ Performance' },
      { key: 'refactor', title: '♻️ Refactoring' },
      { key: 'docs', title: '📝 Documentation' },
      { key: 'test', title: '✅ Tests' },
      { key: 'build', title: '📦 Build' },
      { key: 'ci', title: '🤖 CI' },
      { key: 'style', title: '💄 Styles' },
      { key: 'chore', title: '🔧 Chores' },
      { key: 'revert', title: '⏪ Reverts' }
    ]
    const buckets = new Map<string, string[]>()
    const breaking: string[] = []
    const other: string[] = []
    let count = 0

    const re = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/
    for (const rec of raw.split(REC)) {
      const t = rec.trim()
      if (!t) continue
      const [hash, subject, body] = t.split(SEP)
      if (!subject) continue
      count += 1
      const m = re.exec(subject.trim())
      const isBreaking = !!m?.[3] || /BREAKING[ -]CHANGE/.test(body ?? '')
      if (m) {
        const [, type, scope, , desc] = m
        const line = `- ${scope ? `**${scope}:** ` : ''}${desc} (\`${hash}\`)`
        if (isBreaking) breaking.push(line)
        const key = type.toLowerCase()
        if (GROUPS.some((g) => g.key === key)) {
          const arr = buckets.get(key) ?? []
          arr.push(line)
          buckets.set(key, arr)
        } else {
          other.push(line)
        }
      } else {
        const line = `- ${subject.trim()} (\`${hash}\`)`
        if (isBreaking) breaking.push(line)
        other.push(line)
      }
    }

    const date = new Date().toISOString().slice(0, 10)
    const heading = opts?.version?.trim() || (from ? `${from}..${to}` : to)
    const out: string[] = [`## ${heading} (${date})`, '']
    if (breaking.length) {
      out.push('### ⚠ BREAKING CHANGES', '', ...breaking, '')
    }
    for (const g of GROUPS) {
      const arr = buckets.get(g.key)
      if (arr?.length) out.push(`### ${g.title}`, '', ...arr, '')
    }
    if (other.length) out.push('### Other', '', ...other, '')
    if (count === 0) out.push('_No commits in this range._', '')

    return { markdown: out.join('\n').trimEnd() + '\n', count }
  },

  // ─── Commit editing ─────────────────────────────────────────────────────
  // "Edit any commit like a document": rewrite a historical commit's files or
  // message and replay everything above it — previewed in memory first, so the
  // user sees the whole cascade (including conflicts) before a single ref
  // moves. Merge commits in the range are replayed with their recorded
  // conflict resolutions; the only requirement is ancestry to HEAD.

  /** Can this commit be edited in place, and what would a rewrite drag along? */
  async commitEditInfo(repoPath: string, sha: string): Promise<CommitEditInfo> {
    const range = await commitEditRange(repoPath, sha)
    const descendants = range.ancestor
      ? Number((await runGit(repoPath, ['rev-list', '--count', `${sha}..HEAD`])).trim())
      : 0
    const pushed = Boolean((await runGit(repoPath, ['branch', '-r', '--contains', sha]).catch(() => '')).trim())
    const id = await commitIdentity(repoPath, sha)
    return {
      linear: range.ancestor && range.merges === 0,
      ancestor: range.ancestor,
      merges: range.merges,
      descendants,
      pushed,
      message: id.message,
      authorName: id.name,
      authorDate: id.date
    }
  },

  /** A file's content at a commit, gated for the editor: binary and oversized
   *  blobs come back with `content: null` rather than garbage. */
  async blobAtCommit(repoPath: string, sha: string, file: string): Promise<BlobAtCommit> {
    const size = Number((await runGit(repoPath, ['cat-file', '-s', `${sha}:${file}`])).trim())
    if (size > 2_000_000) return { content: null, binary: false, size }
    const buf = await readBlobBuffer(repoPath, `${sha}:${file}`)
    const binary = buf.subarray(0, 8192).includes(0)
    return { content: binary ? null : buf.toString('utf-8'), binary, size }
  },

  /** Dry-run the rewrite: same engine as apply, no ref ever moves. */
  async commitEditPreview(
    repoPath: string,
    sha: string,
    edits: Record<string, string>,
    message: string
  ): Promise<CommitEditPreview> {
    if (!(await commitEditRange(repoPath, sha)).ancestor) throw new Error('Commit is not an ancestor of HEAD.')
    return rewriteWithEdits(repoPath, sha, edits, message)
  },

  /**
   * Rewrite for real: guard-snapshot the working tree, rebuild the chain, then
   * `reset --keep` the current branch onto the new tip — index and worktree
   * follow, local uncommitted changes are carried over (or the reset aborts
   * and nothing has moved). Refuses detached HEAD and conflicted cascades.
   */
  async commitEditApply(
    repoPath: string,
    sha: string,
    edits: Record<string, string>,
    message: string
  ): Promise<CommitEditResult> {
    if (!(await commitEditRange(repoPath, sha)).ancestor) throw new Error('Commit is not an ancestor of HEAD.')
    await runGit(repoPath, ['symbolic-ref', '-q', 'HEAD']).catch(() => {
      throw new Error('HEAD is detached — check out a branch first.')
    })
    await guardSnapshot(repoPath)
    const oldHead = (await runGit(repoPath, ['rev-parse', 'HEAD'])).trim()
    const { newTip, steps } = await rewriteWithEdits(repoPath, sha, edits, message)
    if (!newTip) throw new Error('The rewrite would conflict — see the preview.')
    await runGit(repoPath, ['reset', '--keep', newTip])
    return { oldHead, newTip, rewritten: steps.length }
  },

  // ─── WIP snapshots ─────────────────────────────────────────────────────
  // A safety net for uncommitted work: the whole working tree — modified,
  // staged AND untracked files — is committed through a throwaway index
  // (read-tree/add/write-tree/commit-tree, so neither the real index nor the
  // stash list is touched) and pinned under refs/githuttbr/wip/ where gc cannot
  // reach it. Taken on a timer, by hand, or as a guard right before a
  // destructive operation (see guardSnapshot). `git stash create` was the old
  // mechanism; it cannot capture untracked files, which is exactly what a
  // `clean` destroys — old stash-shaped refs are still listed and restorable.

  /** Take a snapshot of the current working tree. Returns null when nothing changed. */
  async createSnapshot(repoPath: string, kind: SnapshotKind = 'manual', max = 50): Promise<SnapshotInfo | null> {
    const git = gitFor(repoPath)
    const status = await git.status().catch(() => null)
    if (!status || status.isClean()) return null

    const gitDir = (await runGit(repoPath, ['rev-parse', '--absolute-git-dir'])).trim()
    const tmpIndex = join(gitDir, `githuttbr-snap-${process.pid}-${Date.now()}`)
    const env = { GIT_INDEX_FILE: tmpIndex }
    try {
      const head = (await runGit(repoPath, ['rev-parse', '--verify', 'HEAD']).catch(() => '')).trim()
      // Seed from HEAD so unchanged entries reuse existing blobs, then stage
      // everything — `add -A` in the throwaway index is what pulls untracked
      // files in, the one thing `git stash create` cannot do.
      await runGit(repoPath, ['read-tree', head || '--empty'], env)
      await runGit(repoPath, ['add', '-A'], env)
      const tree = (await runGit(repoPath, ['write-tree'], env)).trim()

      // Nothing effectively changed (e.g. only ignored files were touched).
      const headTree = head ? (await runGit(repoPath, [`rev-parse`, `${head}^{tree}`])).trim() : ''
      if (tree === headTree) return null
      // Timer/guard ticks dedupe against the latest snapshot; a manual
      // "snapshot now" always records, because the user asked for a receipt.
      if (kind !== 'manual') {
        const latest = (await listSnapshotRefs(repoPath))[0]
        const latestTree = latest
          ? (await runGit(repoPath, ['rev-parse', `${latest.sha}^{tree}`]).catch(() => '')).trim()
          : ''
        if (tree === latestTree) return null
      }

      const ts = Math.floor(Date.now() / 1000)
      const label = `githuttbr-wip ${new Date(ts * 1000).toISOString()} (${kind})`
      const sha = (await runGit(repoPath, ['commit-tree', tree, '-m', label, ...(head ? ['-p', head] : [])])).trim()
      // Millisecond ref names keep a guard and a timer tick within the same
      // second from colliding; displayed time comes from the commit, not the name.
      const ref = `${snapshotRefRoot()}/${Date.now()}${SNAPSHOT_SUFFIX[kind]}`
      await git.raw(['update-ref', ref, sha])
      // Prune oldest beyond `max`.
      const all = await listSnapshotRefs(repoPath)
      for (const old of all.slice(max)) await git.raw(['update-ref', '-d', old.ref]).catch(() => {})
      const files = (await gitService.commitFiles(repoPath, sha)).length
      return { ref, sha, time: ts, files, kind }
    } finally {
      await unlink(tmpIndex).catch(() => {})
    }
  },

  /** All saved snapshots, newest first. */
  async listSnapshots(repoPath: string): Promise<SnapshotInfo[]> {
    const refs = await listSnapshotRefs(repoPath)
    const out: SnapshotInfo[] = []
    for (const r of refs) {
      const files = (await gitService.commitFiles(repoPath, r.sha).catch(() => [])).length
      out.push({ ...r, files, kind: kindForSnapshotRef(r.ref) })
    }
    return out
  },

  /**
   * Copy files out of a snapshot back into the working tree (the snapshot is
   * kept). With no `files`, the snapshot's entire tree is restored. Files
   * created after the snapshot are left alone — restore overwrites and
   * recreates, it never deletes.
   */
  async restoreSnapshot(repoPath: string, sha: string, files?: string[]): Promise<void> {
    await gitFor(repoPath).raw(['restore', '--source', sha, '--worktree', '--', ...(files?.length ? files : ['.'])])
  },

  async deleteSnapshot(repoPath: string, ref: string): Promise<void> {
    await gitFor(repoPath).raw(['update-ref', '-d', ref]).catch(() => {})
  },

  /** Prepend a changelog block to CHANGELOG.md (created if absent). */
  async writeChangelogFile(repoPath: string, markdown: string): Promise<void> {
    const file = join(repoPath, 'CHANGELOG.md')
    const existing = await readFile(file, 'utf-8').catch(() => '')
    const header = '# Changelog\n\n'
    const bodyExisting = existing.startsWith(header) ? existing.slice(header.length) : existing
    await writeFile(file, `${header}${markdown.trimEnd()}\n\n${bodyExisting}`.trimEnd() + '\n', 'utf-8')
  },

  async version(): Promise<string> {
    const res = await simpleGit().version()
    return `${res.major}.${res.minor}.${res.patch}`
  }
}

/** Below this age a lock is presumed to belong to a git that is still running,
 *  and is never removed on the user's behalf. Git's own writes finish in
 *  milliseconds; a fetch of a large repo holding `packed-refs.lock` is the slow
 *  end, and stays well inside this. */
const MIN_LOCK_AGE_SECONDS = 30

/** What a lock file guards, from its path inside the git directory. */
function lockKind(rel: string): GitLockFile['kind'] {
  if (rel === 'index.lock') return 'index'
  if (rel === 'config.lock') return 'config'
  if (rel === 'packed-refs.lock' || rel.startsWith('refs/') || rel.startsWith('logs/')) return 'ref'
  return 'other'
}

/** True for git's "Unable to create '...lock': File exists" — the index lock,
 *  but equally `packed-refs.lock` or a single `refs/remotes/<remote>/<branch>.lock`
 *  during a prune. Thrown when another process (this app's own queue is already
 *  serialized, but an IDE's git integration, a terminal, or another Git GUI open
 *  on the same repo) held the lock for the instant this command tried to start.
 *  A live lock is almost always released within milliseconds, so a short retry
 *  clears it without bothering the user — only a genuinely stuck/crashed lock
 *  survives all retries, and that one the user is offered a repair for. */
function isGitLockError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /\.lock['"]?:\s*File exists/i.test(msg)
}

async function withLockRetry<T>(op: () => Promise<T>): Promise<T> {
  const maxAttempts = 5
  for (let attempt = 1; ; attempt++) {
    try {
      return await op()
    } catch (err) {
      if (attempt >= maxAttempts || !isGitLockError(err)) throw err
      await new Promise((r) => setTimeout(r, 150 * attempt))
    }
  }
}

/** Marker the renderer looks for, so a conflicted route edit can be worded in
 *  the user's language with the two branches in it. */
export const ROUTE_CONFLICT = 'GITHUTTBR_ROUTE_CONFLICT'

/**
 * Run a stack edit so that a failure leaves the repository exactly as it was.
 *
 * Reordering a stack is a series of rebases, and rebases conflict — two stops
 * that touch the same lines cannot swap without a human. Git's own answer is to
 * stop mid-rebase and wait, which is right for a rebase the user asked for by
 * name and wrong for a dropdown they nudged: it strands them in a state they
 * did not choose, with half the chain moved and the parent links already
 * rewritten.
 *
 * So every branch this edit can touch is snapshotted first — tip and both
 * config keys — and put back on the way out. What the user sees instead is a
 * message naming the two branches that clash.
 */
async function withStackRollback<T>(
  repoPath: string,
  branches: string[],
  fn: (created: string[]) => Promise<T>
): Promise<T> {
  const git = gitFor(repoPath)
  const names = [...new Set(branches.filter(Boolean))]
  const head = (await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => '')).trim()
  /** Branches `fn` creates, so a rollback can take them away again. */
  const created: string[] = []
  const tips = new Map<string, string>()
  const config = new Map<string, { parent: string; base: string }>()
  for (const b of names) {
    const tip = (await git.revparse([b]).catch(() => '')).trim()
    if (tip) tips.set(b, tip)
    config.set(b, {
      parent: await readStackMeta(git, b, 'parent'),
      base: await readStackMeta(git, b, 'base')
    })
  }
  try {
    const result = await fn(created)
    // A route edit replays branches, and replaying checks them out. Standing
    // somewhere the user did not choose is its own kind of damage, so the
    // branch they were on is restored on the way out as well.
    if (head && head !== 'HEAD') {
      const now = (await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => '')).trim()
      if (now !== head) await git.checkout(head).catch(() => undefined)
    }
    return result
  } catch (err) {
    // Order matters: end the rebase first, stand on the branch we started on,
    // and only then move refs — a ref moved under a checked-out branch leaves
    // the working tree describing a commit that is no longer there.
    await runGit(repoPath, ['rebase', '--abort']).catch(() => undefined)
    if (head && head !== 'HEAD') await git.checkout(head).catch(() => undefined)
    for (const branch of created) await runGit(repoPath, ['branch', '-D', branch]).catch(() => undefined)
    for (const [branch, tip] of tips) {
      if (branch === head) await runGit(repoPath, ['reset', '--hard', tip]).catch(() => undefined)
      else await runGit(repoPath, ['update-ref', `refs/heads/${branch}`, tip]).catch(() => undefined)
    }
    for (const [branch, saved] of config) {
      for (const field of ['parent', 'base'] as const) {
        const value = saved[field]
        if (value) await writeStackMeta(git, branch, field, value).catch(() => undefined)
        else await clearStackMeta(git, branch, field)
      }
    }
    throw err
  }
}

// ─── Per-repo read/write lock ──────────────────────────────────────────────
//
// Writes on a repo run exclusively; reads run concurrently with other reads but
// wait for any in-progress or queued write. This closes the race where a raw
// `git log`/diff read (which bypasses simple-git's per-instance task queue)
// observes the repo mid-checkout/mid-commit and returns an inconsistent commit
// set — the root cause of the graph "bugging itself" after an action.
//
// Grants are FIFO: a run of consecutive readers starts together, but a queued
// writer blocks the readers behind it, so a steady stream of status polls can't
// starve a checkout.
class RwLock {
  private readers = 0
  private writer = false
  private waiters: Array<{ write: boolean; resolve: () => void }> = []

  private canRun(write: boolean): boolean {
    return write ? this.readers === 0 && !this.writer : !this.writer
  }

  private enter(write: boolean): void {
    if (write) this.writer = true
    else this.readers++
  }

  async acquire(write: boolean): Promise<() => void> {
    if (this.waiters.length === 0 && this.canRun(write)) {
      this.enter(write)
    } else {
      await new Promise<void>((resolve) => this.waiters.push({ write, resolve }))
    }
    let released = false
    return () => {
      if (released) return
      released = true
      if (write) this.writer = false
      else this.readers--
      this.pump()
    }
  }

  private pump(): void {
    while (this.waiters.length) {
      const head = this.waiters[0]
      if (!this.canRun(head.write)) break
      this.waiters.shift()
      this.enter(head.write)
      head.resolve()
      if (head.write) break // exclusive writer — stop granting
    }
  }
}

const repoLocks = new Map<string, RwLock>()
function lockFor(repoPath: string): RwLock {
  let l = repoLocks.get(repoPath)
  if (!l) {
    l = new RwLock()
    repoLocks.set(repoPath, l)
  }
  return l
}

// Pure reads — safe to run concurrently with each other. Anything NOT listed is
// treated as a write (exclusive), so an unmapped/new method serializes rather
// than risking a concurrent mutation. Only add a method here if it never
// touches the index, working tree, refs, config, or hook files.
/** Methods whose first argument is not a repository path: they run before a
 *  repo exists locally, or against a remote URL. No lock, no repo-scoped log. */
const APP_LEVEL_METHODS = new Set<string>(['clone', 'cancelClone', 'init', 'remoteBranches'])

const READ_METHODS = new Set<string>([
  'getLocalCommits',
  'getCommitRangeFiles',
  'getMergeBase',
  'isAncestor',
  'isRepository',
  'directoryExists',
  'open',
  'lastFetchAt',
  'upstreamSuggestion',
  'staleLocks',
  'remoteHasBranches',
  'log',
  'branches',
  'status',
  'stashes',
  'remotes',
  // Reads .git/config and returns only which URLs carry credentials, never them.
  'getRemoteUrlCredentials',
  // Resolves the profile's credential and may ask git's helper; returns a boolean only.
  'remoteHasProfileCredential',
  'remoteAuthChecks',
  'stackInfo',
  'stackLeaves',
  'listDir',
  'listDirAt',
  'timelapseData',
  'repoPulse',
  'repoDetail',
  'listFiles',
  'listTrackedFiles',
  'ignoredTrackedFiles',
  'commitSummary',
  'filesToPush',
  // The multi-branch push dialog's reads: refs and history, nothing written.
  'branchPushStates',
  'outgoingFiles',
  // The branch cleanup's scan: refs, config and history, nothing written.
  'getBranchCleanupCandidates',
  // Loose tree objects only, like mergePreview: no ref, index or worktree moves.
  'getSquashMergedBranches',
  'commitsTouchingPath',
  'protectedBranches',
  'repoConfig',
  'repoDoctor',
  'suggestRepoConfig',
  'fileSizes',
  'treeStatus',
  'getCommitMessage',
  'resolveRev',
  'commitTemplate',
  'reflog',
  'bisectStatus',
  'getRemoteTags',
  'remoteBranches',
  'gitflowStatus',
  'rerereStatus',
  'subtrees',
  'cleanPreview',
  // Writing a bundle or an archive reads the object database and touches
  // nothing in the repository — the file it produces lives outside it.
  'bundleCreate',
  'bundleInspect',
  'archiveCreate',
  'maintenanceStats',
  'fsck',
  'objectRefs',
  'gitObject',
  'attributeFiles',
  'checkAttributes',
  'credentialStatus',
  'replacements',
  'diffDrivers',
  'diffDriverSuggestions',
  'filterDrivers',
  'filterDryRun',
  'conflictCommits',
  'note',
  'notedCommits',
  'historyPaths',
  'historyPurgePreview',
  'historyPurgeBackups',
  'diffFile',
  'commitFiles',
  'stashFiles',
  'stashFileDiff',
  'commitFileDiff',
  'formatPatch',
  'stagedDiff',
  'commitDiff',
  'commitBranches',
  'commitTags',
  'fileContent',
  'searchFileContents',
  'searchFileMatches',
  'searchCommitMatches',
  'grepWorkingTree',
  'searchHistory',
  'fileDataUrl',
  'repoImage',
  'imageDiff',
  'blameFile',
  'fileHistory',
  'worktrees',
  'worktreeRoot',
  'getWorktreeStatus',
  'submodules',
  'signingConfig',
  'hooksInfo',
  'readHook',
  'lfsInfo',
  'sparseCheckoutInfo',
  'getUser',
  'mergeState',
  'mergeMessage',
  'conflictContext',
  'conflictVersions',
  'interactiveRebaseSteps',
  'compareBranches',
  'prComparison',
  'mergePreview',
  'teammateRadar',
  'commitEditInfo',
  'commitMenuProbe',
  'blobAtCommit',
  'semanticDiff',
  'rangeDiff',
  'refTips',
  'absorbPlan',
  'repoStats',
  'repoInsights',
  'cosmosData',
  'generateChangelog',
  'listSnapshots',
  'contributors',
  'version'
])

export function gitMethodIsRead(method: string): boolean {
  return READ_METHODS.has(method)
}

export function registerGitHandlers(): void {
  ipcMain.handle('git', async (_e, method: string, ...args: unknown[]) => {
    const fn = (gitService as Record<string, unknown>)[method]
    if (typeof fn !== 'function') throw new Error(`Unknown git method: ${method}`)
    const event = eventForCall(method, args)
    // Stream clone progress back to the renderer. Functions can't cross IPC, so the
    // callback is appended here (after the renderer's positional args).
    if (method === 'clone') {
      args = [
        ...args,
        (p: CloneProgress) => {
          if (!_e.sender.isDestroyed()) _e.sender.send('clone:progress', p)
        }
      ]
    }
    // Same shape for a scripted bisect: it runs for minutes and its output is
    // the only sign it is alive.
    if (method === 'bisectRunScript') {
      args = [
        ...args,
        (chunk: string) => {
          if (!_e.sender.isDestroyed()) _e.sender.send('bisect:output', chunk)
        }
      ]
    }
    // First positional arg is the repo path for almost every method; the
    // app-level ones take a URL or a parent folder instead.
    const repoScoped = typeof args[0] === 'string' && !APP_LEVEL_METHODS.has(method)
    const repoPath = event && repoScoped ? (args[0] as string) : ''

    // Serialize this call under the repo's read/write lock. The lock key is the
    // repo path for every repo-scoped method (not just logged ones); the
    // app-level ones run before (or without) a local repo, so they take no lock.
    const lockKey = repoScoped ? (args[0] as string) : null
    const isWrite = !gitMethodIsRead(method)
    // A superseded search is stopped before the new one queues for the lock, or
    // a write waiting between them would hold both back.
    if (method === 'searchFileMatches' && lockKey) {
      supersedeSearch(lockKey, (args[3] as FileSearchOptions | undefined)?.searchId)
    }
    // Hooks run on writes and need the login-shell PATH (main/fix-path.ts).
    if (isWrite) await shellPathReady()
    const release = lockKey ? await lockFor(lockKey).acquire(isWrite) : null

    try {
      const result = await withLockRetry(() => (fn as (...a: unknown[]) => Promise<unknown>)(...args))
      if (event) {
        void recordEvent(event)
        void recordLog({ event, repoPath, ok: true })
      }
      return result
    } catch (err) {
      // Redact at the boundary as well as in `runGit`: simple-git and any other
      // path can surface a URL we transiently injected a token into, and this is
      // the last point before the message reaches the log and the renderer.
      const message = redactCredentials(err instanceof Error ? err.message : String(err))
      if (event) void recordLog({ event, repoPath, ok: false, error: message })
      throw err instanceof Error ? Object.assign(err, { message }) : new Error(message)
    } finally {
      release?.()
    }
  })
}
