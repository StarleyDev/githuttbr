import type { SettingsDecryptResult } from '../../../shared/settingsEncryption'
import type { TokenCheckResult } from '../../../shared/tokenCheck'
import type {
  RollbackState,
  LaunchInput,
  LaunchInputResolution,
  SecretsState,
  SettingsReply,
  SettingsReplyWire,
  SettingsSaveOptions
} from '../../../shared/types'
import type {
  AskPlan,
  DoctorCheck,
  EnvCheck,
  DoctorFix,
  RepoConfig,
  RepoConfigResult,
  DetectedCli,
  SubscriptionCli,
  SubscriptionTest,
  ModelCatalog,
  BlameLine,
  BranchCompareResult,
  PrComparison,
  BranchesPayload,
  CheckoutRemoteResult,
  DivergedStrategy,
  BlobSpec,
  MergePreviewResult,
  SemanticDiff,
  RangeDiffEntry,
  RefTip,
  ForcedRefUpdate,
  UpstreamSuggestion,
  GitLockFile,
  GithubStackInfo,
  AbsorbPlan,
  TimelapseCommit,
  RepoPulse,
  RepoDetail,
  CiStatus,
  CloneOptions,
  CloneProgress,
  GitflowConfig,
  GitflowKind,
  GitflowSnapshot,
  GitflowStatus,
  HistoryPathEntry,
  HistoryPurgePreview,
  HistoryPurgeResult,
  HistoryPurgeBackup,
  CommitBranchInfo,
  ConflictContext,
  ConflictOpKind,
  ConflictSide,
  ConflictVersions,
  FileEntry,
  FileHistoryEntry,
  FsDropMode,
  GraphCommit,
  RebaseStep,
  RemoteInfo,
  RemoteAuthCheck,
  RemoteUrlCredentials,
  PushRemoteResult,
  BranchPushState,
  BranchCleanupScan,
  BranchDeleteRequest,
  BranchDeleteResult,
  BranchRestoreRequest,
  BranchRestoreResult,
  BranchSquashCheck,
  PushBranchesResult,
  RepoStatus,
  RerereStatus,
  RepoSummary,
  StashInfo,
  AIConfig,
  AppSettings,
  PrPreviewMode,
  PrPreviewResult,
  PrRefProbe,
  PullRequest,
  FinishedPullRequests,
  PrDetail,
  ReferenceQuery,
  ReferenceSummary,
  PrReviewEvent,
  PrMergeMethod,
  IssueInfo,
  IssueDetail,
  MilestoneInfo,
  ReleaseInfo,
  HostingAccess,
  HostingProvider,
  RepoHost,
  RemoteRepo,
  RemoteOwner,
  AccountLink,
  ConnectedAccount,
  CreateRepoOpts,
  CreatePrOpts,
  CreatePrResult,
  PrPickerOptions,
  WorktreeInfo,
  WorktreeStatus,
  SubmoduleInfo,
  SubtreeInfo,
  CleanPreview,
  CleanResult,
  ArchiveFormat,
  ArchiveResult,
  AttributeCheck,
  CredentialStatus,
  ReplaceStatus,
  AttributeFile,
  DiffDriverInfo,
  DiffDriverRepoint,
  FilterDriverInfo,
  FilterDryRunResult,
  FilterDriverPrevious,
  DiffDriverSuggestion,
  ConflictCommit,
  GitObject,
  RefObject,
  MergeOptions,
  FsckReport,
  MaintenanceResult,
  MaintenanceStats,
  MaintenanceTask,
  BundleInfo,
  BundleResult,
  BundleScope,
  AppThemeColors,
  CodeThemeColors,
  Analytics,
  LogEntry,
  RepoStats,
  ReflogEntry,
  BisectStatus,
  SigningConfig,
  HooksInfo,
  LfsInfo,
  SparseCheckoutInfo,
  TreeEntry,
  TreeStatusKind,
  CodeSearchHit,
  HistorySearchHit,
  GitHubNotification,
  StackInfo,
  RepoInsights,
  CosmosCommit,
  ChangelogResult,
  SnapshotInfo,
  SavedWork,
  SnapshotKind,
  TeammateRadarResult,
  CommitEditInfo,
  CommitEditPreview,
  CommitEditResult,
  CommitMenuProbe,
  UndoCommitResult,
  BlobAtCommit,
  VaultEntry,
  VaultListResult,
  VaultExport,
  VaultExportReply,
  VaultImportReply,
  InfoEntry,
  InfoExport,
  SecureShareCandidate,
  SecureBundleHeader,
  SecureSharePreviewEntry,
  SecureShareError,
  SecureExportSpec,
  SecureBundleOpened,
  SecureApplyPlan,
  SecureApplyResult,
  PRReviewResult,
  HoverExplainRequest,
  HoverExplainResult,
  EditSelectionRequest,
  ImportGraph,
  KeychainConsent,
  KeychainReason,
  RepoFacts,
  RepoChatAttachment,
  RepoChatMessage,
  RepoChatProgress,
  RepoChatReply,
  AIRequestEvent,
  AISlowChoice,
  RepoChatExecutionResult,
  PreparedRepoChatFileAction,
  RepoFileBatchResult,
  RepoWiki,
  WikiProgress,
  RegistryRepo,
  RepoScanRoot,
  RepoScanResult,
  SettingsErrorKind,
  SettingsRefusal,
  MoveAsideReply
} from '../../../shared/types'
import type {
  LocalCiStatus,
  LocalCiSweepProgress,
  LocalCiSweepResult,
  LocalCiVerdict,
  LocalCiWorkflow
} from '../../../shared/localCi'
import type { EditorSetting, EditorTarget } from '../../../shared/editors'
import type { MenuSpec } from '../../../shared/menu'
import type { EditMenuLabels } from '../../../shared/editMenu'
import type { CliOpenPayload } from '../../../shared/cli'
import type { TranslationKey } from '../i18n'
import { guardAI, type GuardDeps } from '../lib/aiGuard'

// Typed adapter over the IPC bridge — the only place that talks to window.api.
const call = <T>(method: string, ...args: unknown[]): Promise<T> => window.api.git(method, ...args) as Promise<T>

export const gitApi = {
  isRepository: (path: string) => call<boolean>('isRepository', path),
  directoryExists: (path: string) => call<boolean>('directoryExists', path),
  open: (path: string) => call<RepoSummary>('open', path),
  log: (path: string, max?: number, skip?: number) => call<GraphCommit[]>('log', path, max, skip),
  branches: (path: string) => call<BranchesPayload>('branches', path),
  status: (path: string) => call<RepoStatus>('status', path),
  stashes: (path: string) => call<StashInfo[]>('stashes', path),
  remotes: (path: string) => call<RemoteInfo[]>('remotes', path),
  remoteAuthChecks: (path: string) => call<RemoteAuthCheck[]>('remoteAuthChecks', path),
  getRemoteUrlCredentials: (path: string) => call<RemoteUrlCredentials[]>('getRemoteUrlCredentials', path),
  remoteHasProfileCredential: (path: string, remote: string) =>
    call<boolean>('remoteHasProfileCredential', path, remote),
  removeRemoteUrlCredentials: (path: string, remote: string) => call<void>('removeRemoteUrlCredentials', path, remote),
  addRemote: (path: string, name: string, url: string, pushUrl?: string) =>
    call<void>('addRemote', path, name, url, pushUrl),
  removeRemote: (path: string, name: string) => call<void>('removeRemote', path, name),
  editRemote: (path: string, oldName: string, newName: string, url: string, pushUrl?: string) =>
    call<void>('editRemote', path, oldName, newName, url, pushUrl),
  fetchRemote: (path: string, name: string) => call<void>('fetchRemote', path, name),
  fetchRemoteBranch: (path: string, remote: string, branch: string) =>
    call<boolean>('fetchRemoteBranch', path, remote, branch),
  getLocalCommits: (path: string, shas: string[]) => call<string[]>('getLocalCommits', path, shas),
  fetchCommitsById: (path: string, remote: string, shas: string[]) => call<boolean>('fetchCommitsById', path, remote, shas),
  getCommitRangeFiles: (path: string, from: string, to: string) =>
    call<import('../../../shared/types').PrFile[]>('getCommitRangeFiles', path, from, to),
  /** A pull request's head, by its number, into `<remote>/pr/<number>`; null when the remote publishes none. */
  fetchPrHead: (path: string, remote: string, number: number) => call<string | null>('fetchPrHead', path, remote, number),
  resolvePrRef: (path: string, remote: string, number: number) =>
    call<PrRefProbe | null>('resolvePrRef', path, remote, number),
  previewRef: (path: string, remote: string, ref: string, mode: PrPreviewMode, localBranch?: string) =>
    call<PrPreviewResult>('previewRef', path, remote, ref, mode, localBranch),

  checkout: (path: string, ref: string) => call<void>('checkout', path, ref),
  checkoutRemote: (path: string, fullName: string, localName: string, remote?: string) =>
    call<CheckoutRemoteResult>('checkoutRemote', path, fullName, localName, remote),
  resolveDivergedCheckout: (
    path: string,
    fullName: string,
    localName: string,
    strategy: DivergedStrategy,
    backup: boolean
  ) => call<{ backupRef?: string; previousRef: string }>('resolveDivergedCheckout', path, fullName, localName, strategy, backup),
  createBranch: (path: string, name: string, at?: string, checkout?: boolean) =>
    call<void>('createBranch', path, name, at, checkout),
  deleteBranch: (path: string, name: string, force?: boolean) => call<void>('deleteBranch', path, name, force),
  deleteBranchIfAt: (path: string, name: string, sha: string) => call<boolean>('deleteBranchIfAt', path, name, sha),
  getBranchCleanupCandidates: (path: string) => call<BranchCleanupScan>('getBranchCleanupCandidates', path),
  getSquashMergedBranches: (path: string, names: string[]) =>
    call<BranchSquashCheck[]>('getSquashMergedBranches', path, names),
  deleteLocalBranches: (path: string, requests: BranchDeleteRequest[]) =>
    call<BranchDeleteResult[]>('deleteLocalBranches', path, requests),
  restoreLocalBranches: (path: string, requests: BranchRestoreRequest[]) =>
    call<BranchRestoreResult[]>('restoreLocalBranches', path, requests),
  deleteRemoteBranch: (path: string, remote: string, name: string) =>
    call<void>('deleteRemoteBranch', path, remote, name),
  stackInfo: (path: string, leaf?: string) => call<StackInfo>('stackInfo', path, leaf),
  /** The leaf of every stack recorded in this repository. */
  stackLeaves: (path: string) => call<string[]>('stackLeaves', path),
  stackSetParent: (path: string, branch: string, parent: string) =>
    call<void>('stackSetParent', path, branch, parent),
  stackClearParent: (path: string, branch: string) => call<void>('stackClearParent', path, branch),
  stackRestack: (path: string, leaf: string) => call<void>('stackRestack', path, leaf),
  /** Re-link a stack to `order` (bottom → top on `trunk`) and replay it. */
  stackReorder: (path: string, trunk: string, order: string[]) =>
    call<void>('stackReorder', path, trunk, order),
  /** Which of these branches the remote actually has (one ls-remote). */
  remoteHasBranches: (path: string, remote: string, branches: string[]) =>
    call<string[]>('remoteHasBranches', path, remote, branches),
  /** Set the whole route: `order` on `trunk`, untracking anything left out. */
  stackSetRoute: (path: string, trunk: string, order: string[]) =>
    call<void>('stackSetRoute', path, trunk, order),
  /** Add a level on top of `parent`, re-pointing whatever sat there at it. */
  stackInsert: (path: string, name: string, parent: string) => call<void>('stackInsert', path, name, parent),
  renameBranch: (path: string, oldName: string, newName: string) => call<void>('renameBranch', path, oldName, newName),
  renameBranchRemote: (path: string, oldName: string, newName: string, remote: string) =>
    call<void>('renameBranchRemote', path, oldName, newName, remote),
  merge: (path: string, ref: string, options?: MergeOptions) => call<void>('merge', path, ref, options),
  /** The commits from each side that touched a conflicted file (`git log --merge`). */
  conflictCommits: (path: string, file: string) => call<ConflictCommit[]>('conflictCommits', path, file),
  mergeInto: (path: string, source: string, target: string, noFf?: boolean) =>
    call<void>('mergeInto', path, source, target, noFf),
  rebase: (path: string, onto: string) => call<void>('rebase', path, onto),
  rebaseOnto: (path: string, branch: string, onto: string) => call<void>('rebaseOnto', path, branch, onto),
  commitFixup: (path: string, targetSha: string) => call<void>('commitFixup', path, targetSha),
  autosquash: (path: string, base: string) => call<void>('autosquash', path, base),

  fetchAll: (path: string) => call<ForcedRefUpdate[]>('fetchAll', path),
  /** When the repo last fetched, from FETCH_HEAD — a CLI fetch counts too. */
  lastFetchAt: (path: string) => call<number | null>('lastFetchAt', path),
  pull: (path: string, mode: 'default' | 'ff-only' | 'rebase') => call<void>('pull', path, mode),
  /** Push `local` to a differently named branch on `remote`; never forced. */
  pushRef: (path: string, local: string, remote: string, remoteBranch: string) =>
    call<void>('pushRef', path, local, remote, remoteBranch),
  push: (path: string, branch: string, opts?: { force?: boolean; remote?: string }) =>
    call<void>('push', path, branch, opts),
  /** Why a pull found no tracking information, and which repair fits. */
  upstreamSuggestion: (path: string) => call<UpstreamSuggestion | null>('upstreamSuggestion', path),
  /** Set the branch's upstream to `<remote>/<branch>`; a null remote unsets it. */
  setUpstream: (path: string, branch: string, remote: string | null) =>
    call<void>('setUpstream', path, branch, remote),
  /** Every `*.lock` file sitting in the repo's git directory, youngest first. */
  staleLocks: (path: string) => call<GitLockFile[]>('staleLocks', path),
  /** Delete lock files by relative path; returns how many were actually removed. */
  clearLocks: (path: string, paths: string[]) => call<number>('clearLocks', path, paths),
  /** Fast-forward a local branch from its upstream without checking it out. */
  pullBranch: (path: string, branch: string) => call<void>('pullBranch', path, branch),
  setBranchRef: (path: string, branch: string, sha: string) => call<void>('setBranchRef', path, branch, sha),
  moveBranchTo: (path: string, branch: string, sha: string) => call<string>('moveBranchTo', path, branch, sha),
  isAncestor: (path: string, ancestor: string, descendant: string) =>
    call<boolean>('isAncestor', path, ancestor, descendant),
  /** Returns the commit `target` was on, for undo. */
  fastForwardBranch: (path: string, target: string, source: string) =>
    call<string>('fastForwardBranch', path, target, source),
  /** One push per remote, reported separately — one rejection does not cancel
   *  the rest. */
  pushToRemotes: (path: string, branch: string, remotes: string[], opts?: { force?: boolean; tags?: boolean }) =>
    call<PushRemoteResult[]>('pushToRemotes', path, branch, remotes, opts),
  pushAllTags: (path: string, remote?: string) => call<void>('pushAllTags', path, remote),
  /** Every local branch against `remote` — ahead/behind, new, diverged. */
  branchPushStates: (path: string, remote: string) => call<BranchPushState[]>('branchPushStates', path, remote),
  /** Per branch, the files its not-yet-published commits touch — the secret guard's input. */
  outgoingFiles: (path: string, remote: string, branches: string[]) =>
    call<Record<string, string[]>>('outgoingFiles', path, remote, branches),
  /** Several branches in one non-forced `git push`, reported per branch. */
  pushBranches: (
    path: string,
    remote: string,
    branches: string[],
    opts: { setUpstream: boolean; atomic?: boolean; toUpstream?: string[] }
  ) =>
    call<PushBranchesResult>('pushBranches', path, remote, branches, opts),

  cherryPickMany: (path: string, hashes: string[], noCommit?: boolean) =>
    call<void>('cherryPickMany', path, hashes, noCommit),
  squashCommits: (path: string, oldestSha: string, message: string) =>
    call<void>('squashCommits', path, oldestSha, message),
  contributors: (path: string, max?: number) =>
    call<{ name: string; email: string }[]>('contributors', path, max),
  stash: (path: string, message?: string) => call<void>('stash', path, message),
  stashPush: (path: string, message?: string, paths?: string[], keepIndex?: boolean) =>
    call<void>('stashPush', path, message, paths, keepIndex),
  stashPop: (path: string, index?: number) => call<void>('stashPop', path, index),
  stashToBranch: (path: string, branch: string, index?: number) =>
    call<void>('stashToBranch', path, branch, index),
  stashApply: (path: string, index?: number) => call<void>('stashApply', path, index),
  stashApplyOverwrite: (path: string, index?: number, pop?: boolean) =>
    call<void>('stashApplyOverwrite', path, index, pop),
  stashDrop: (path: string, index?: number) => call<void>('stashDrop', path, index),
  renameStash: (path: string, index: number, message: string) => call<void>('renameStash', path, index, message),
  stashApplyFiles: (path: string, sha: string, tracked: string[], untracked: string[]) =>
    call<void>('stashApplyFiles', path, sha, tracked, untracked),
  restoreFromCommit: (path: string, hash: string, paths: string[]) =>
    call<void>('restoreFromCommit', path, hash, paths),
  captureWork: (path: string, paths?: string[]) => call<SavedWork | null>('captureWork', path, paths),
  restoreWork: (path: string, saved: SavedWork, paths: string[]) => call<void>('restoreWork', path, saved, paths),

  stage: (path: string, files: string[]) => call<void>('stage', path, files),
  applyRepoFileActions: (path: string, actions: PreparedRepoChatFileAction[]) =>
    call<RepoFileBatchResult>('applyRepoFileActions', path, actions),
  stageAll: (path: string) => call<void>('stageAll', path),
  unstage: (path: string, files: string[]) => call<void>('unstage', path, files),
  unstageAll: (path: string) => call<void>('unstageAll', path),
  discard: (path: string, files: string[], untracked: boolean) => call<void>('discard', path, files, untracked),
  addToGitignore: (path: string, patterns: string[]) => call<string[]>('addToGitignore', path, patterns),
  addToGitignoreAt: (path: string, dir: string, patterns: string[]) =>
    call<string[]>('addToGitignoreAt', path, dir, patterns),
  untrack: (path: string, files: string[], deleteFromDisk?: boolean) =>
    call<void>('untrack', path, files, deleteFromDisk),

  listDir: (path: string, relDir?: string) => call<TreeEntry[]>('listDir', path, relDir),
  listDirAt: (path: string, ref: string, relDir?: string) => call<TreeEntry[]>('listDirAt', path, ref, relDir),
  timelapseData: (path: string, max?: number) => call<TimelapseCommit[]>('timelapseData', path, max),
  repoPulse: (path: string) => call<RepoPulse>('repoPulse', path),
  repoDetail: (path: string, max?: number) => call<RepoDetail>('repoDetail', path, max),
  listFiles: (path: string) => call<string[]>('listFiles', path),
  listTrackedFiles: (path: string) => call<string[]>('listTrackedFiles', path),
  filesToPush: (path: string, branch: string) => call<string[]>('filesToPush', path, branch),
  commitsTouchingPath: (path: string, target: string) =>
    call<string[]>('commitsTouchingPath', path, target),
  protectedBranches: (path: string) => call<string[]>('protectedBranches', path),
  setProtectedBranches: (path: string, branches: string[]) =>
    call<void>('setProtectedBranches', path, branches),
  repoConfig: (path: string) => call<RepoConfigResult>('repoConfig', path),
  setRepoConfig: (path: string, config: RepoConfig) =>
    call<RepoConfigResult>('setRepoConfig', path, config),
  repoDoctor: (path: string) => call<DoctorCheck[]>('repoDoctor', path),
  applyDoctorFix: (path: string, fix: DoctorFix) => call<void>('applyDoctorFix', path, fix),
  suggestRepoConfig: (path: string) => call<RepoConfig>('suggestRepoConfig', path),

  /** Every path ever committed, heaviest first — the purge dialog's picker. */
  /** Whether git is memorising conflict resolutions, and what it replayed here. */
  rerereStatus: (path: string) => call<RerereStatus>('rerereStatus', path),
  setRerere: (path: string, values: { enabled?: boolean; autoUpdate?: boolean }, scope?: 'global' | 'repo') =>
    call<void>('setRerere', path, values, scope),
  rerereForget: (path: string, file: string) => call<void>('rerereForget', path, file),
  rerereClear: (path: string) => call<void>('rerereClear', path),

  /** Directories vendored in with `git subtree`, discovered from history. */
  subtrees: (path: string) => call<SubtreeInfo[]>('subtrees', path),
  subtreeAdd: (path: string, prefix: string, url: string, ref: string, squash?: boolean) =>
    call<void>('subtreeAdd', path, prefix, url, ref, squash),
  subtreePull: (path: string, prefix: string, url: string, ref: string, squash?: boolean) =>
    call<void>('subtreePull', path, prefix, url, ref, squash),
  subtreePush: (path: string, prefix: string, url: string, ref: string) =>
    call<void>('subtreePush', path, prefix, url, ref),
  subtreeSplit: (path: string, prefix: string, branch: string) =>
    call<string>('subtreeSplit', path, prefix, branch),
  subtreeForget: (path: string, prefix: string) => call<void>('subtreeForget', path, prefix),

  /** Replacement refs, and whether git is honouring them here. */
  replacements: (path: string) => call<ReplaceStatus>('replacements', path),
  replaceGraft: (path: string, commit: string, parents: string[]) =>
    call<string>('replaceGraft', path, commit, parents),
  replaceObject: (path: string, original: string, replacement: string) =>
    call<void>('replaceObject', path, original, replacement),
  replaceDelete: (path: string, original: string) => call<void>('replaceDelete', path, original),
  setUseReplaceRefs: (path: string, enabled: boolean) => call<void>('setUseReplaceRefs', path, enabled),

  /** How git will answer the next password prompt. Reads config only — never a secret. */
  credentialStatus: (path: string) => call<CredentialStatus>('credentialStatus', path),
  setCredentialHelper: (path: string, value: string, scope: 'global' | 'repo') =>
    call<void>('setCredentialHelper', path, value, scope),
  forgetCredential: (path: string, host: string) => call<void>('forgetCredential', path, host),

  /** Every .gitattributes in the repository, plus the private local one. */
  attributeFiles: (path: string) => call<AttributeFile[]>('attributeFiles', path),
  attributeWrite: (path: string, file: string, content: string) =>
    call<void>('attributeWrite', path, file, content),
  /** What git says applies to these paths, after every attributes file. */
  checkAttributes: (path: string, paths: string[]) => call<AttributeCheck[]>('checkAttributes', path, paths),
  diffDrivers: (path: string) => call<DiffDriverInfo[]>('diffDrivers', path),
  diffDriverSuggestions: (path: string) => call<DiffDriverSuggestion[]>('diffDriverSuggestions', path),
  repointLegacyDiffDrivers: (path: string) => call<DiffDriverRepoint[]>('repointLegacyDiffDrivers', path),
  setDiffDriver: (path: string, name: string, textconv: string, global?: boolean) =>
    call<void>('setDiffDriver', path, name, textconv, global),
  filterDrivers: (path: string) => call<FilterDriverInfo[]>('filterDrivers', path),
  /** Try a clean/smudge pair on real matching files without configuring anything. */
  filterDryRun: (path: string, pattern: string, clean: string, smudge: string) =>
    call<FilterDryRunResult>('filterDryRun', path, pattern, clean, smudge),
  setFilterDriver: (path: string, name: string, driver: { clean: string; smudge: string; required: boolean }, global?: boolean) =>
    call<FilterDriverPrevious>('setFilterDriver', path, name, driver, global),

  /** Every ref, plus HEAD, with the object it names — the explorer's roots. */
  objectRefs: (path: string) => call<RefObject[]>('objectRefs', path),
  /** Any revision expression, resolved and decoded. Pure inspection. */
  gitObject: (path: string, rev: string) => call<GitObject>('gitObject', path, rev),

  /** Disk usage and what maintenance could reclaim. Walks reachability — slow. */
  maintenanceStats: (path: string) => call<MaintenanceStats>('maintenanceStats', path),
  maintenanceRun: (path: string, task: MaintenanceTask) =>
    call<MaintenanceResult>('maintenanceRun', path, task),
  maintenanceSchedule: (path: string, on: boolean) => call<boolean>('maintenanceSchedule', path, on),
  fsck: (path: string) => call<FsckReport>('fsck', path),

  /** A repository, a branch or a range of commits as one file. */
  bundleCreate: (path: string, file: string, scope: BundleScope) =>
    call<BundleResult>('bundleCreate', path, file, scope),
  bundleInspect: (path: string, file: string) => call<BundleInfo>('bundleInspect', path, file),
  bundleFetch: (path: string, file: string, refs: string[]) => call<string[]>('bundleFetch', path, file, refs),
  /** One tree as a zip or tarball, honouring export-ignore. */
  archiveCreate: (
    path: string,
    file: string,
    ref: string,
    format: ArchiveFormat,
    prefix: string,
    subdir: string
  ) => call<ArchiveResult>('archiveCreate', path, file, ref, format, prefix, subdir),

  /** Untracked and ignored paths `git clean` would remove, with their sizes. */
  cleanPreview: (path: string) => call<CleanPreview>('cleanPreview', path),
  clean: (path: string, paths: string[], trash: boolean) => call<CleanResult>('clean', path, paths, trash),

  note: (path: string, sha: string) => call<string>('note', path, sha),
  /** Shas carrying a note — one cheap call, so the graph can mark them. */
  notedCommits: (path: string) => call<string[]>('notedCommits', path),
  setNote: (path: string, sha: string, text: string) => call<void>('setNote', path, sha, text),
  removeNote: (path: string, sha: string) => call<void>('removeNote', path, sha),
  fetchNotes: (path: string, remote?: string) => call<void>('fetchNotes', path, remote),
  pushNotes: (path: string, remote?: string) => call<void>('pushNotes', path, remote),

  historyPaths: (path: string, max?: number) => call<HistoryPathEntry[]>('historyPaths', path, max),
  historyPurgePreview: (path: string, paths: string[]) =>
    call<HistoryPurgePreview>('historyPurgePreview', path, paths),
  historyPurge: (path: string, paths: string[]) => call<HistoryPurgeResult>('historyPurge', path, paths),
  historyPurgeBackups: (path: string) => call<HistoryPurgeBackup[]>('historyPurgeBackups', path),
  historyPurgeRestore: (path: string, prefix: string) => call<void>('historyPurgeRestore', path, prefix),
  historyPurgeDropBackup: (path: string, prefix: string) => call<void>('historyPurgeDropBackup', path, prefix),

  gitflowStatus: (path: string) => call<GitflowStatus>('gitflowStatus', path),
  gitflowInit: (path: string, config: GitflowConfig) => call<void>('gitflowInit', path, config),
  gitflowStart: (path: string, kind: GitflowKind, name: string) =>
    call<string>('gitflowStart', path, kind, name),
  gitflowFinish: (
    path: string,
    kind: GitflowKind,
    name: string,
    opts?: { tag?: boolean; deleteBranch?: boolean; message?: string }
  ) => call<GitflowSnapshot>('gitflowFinish', path, kind, name, opts),
  gitflowUndo: (path: string, snapshot: GitflowSnapshot) => call<void>('gitflowUndo', path, snapshot),
  fileSizes: (path: string, files: string[]) =>
    call<Record<string, { size: number; binary: boolean }>>('fileSizes', path, files),
  treeStatus: (path: string) => call<Record<string, TreeStatusKind>>('treeStatus', path),
  fsCreate: (path: string, relPath: string, isDir: boolean) => call<void>('fsCreate', path, relPath, isDir),
  fsRename: (path: string, from: string, to: string) => call<void>('fsRename', path, from, to),
  fsDelete: (path: string, relPaths: string[]) => call<void>('fsDelete', path, relPaths),
  fsExisting: (path: string, destDir: string, names: string[]) =>
    call<string[]>('fsExisting', path, destDir, names),
  fsMove: (path: string, froms: string[], destDir: string, mode?: FsDropMode) =>
    call<void>('fsMove', path, froms, destDir, mode),
  fsImport: (path: string, srcPaths: string[], destDir: string, mode?: FsDropMode) =>
    call<void>('fsImport', path, srcPaths, destDir, mode),
  commit: (path: string, message: string, amend?: boolean) => call<void>('commit', path, message, amend),
  getCommitMessage: (path: string, hash: string) => call<string>('getCommitMessage', path, hash),
  resolveRev: (path: string, rev: string) => call<string | null>('resolveRev', path, rev),
  commitTemplate: (path: string) => call<string>('commitTemplate', path),
  amendCommitMessage: (path: string, message: string) => call<void>('amendCommitMessage', path, message),

  cherryPick: (path: string, hash: string, noCommit?: boolean) => call<void>('cherryPick', path, hash, noCommit),
  revertCommit: (path: string, hash: string) => call<void>('revertCommit', path, hash),
  reset: (path: string, ref: string, mode: 'soft' | 'mixed' | 'hard' | 'keep') =>
    call<void>('reset', path, ref, mode),
  commitMenuProbe: (path: string, sha: string) => call<CommitMenuProbe>('commitMenuProbe', path, sha),
  undoCommit: (path: string) => call<UndoCommitResult>('undoCommit', path),
  restoreUndoneCommit: (path: string, previousSha: string) =>
    call<void>('restoreUndoneCommit', path, previousSha),
  reflog: (path: string, ref?: string, max?: number) => call<ReflogEntry[]>('reflog', path, ref, max),
  bisectStatus: (path: string) => call<BisectStatus>('bisectStatus', path),
  bisectStart: (path: string) => call<BisectStatus>('bisectStart', path),
  bisectMark: (path: string, term: 'good' | 'bad' | 'skip', rev?: string) =>
    call<BisectStatus>('bisectMark', path, term, rev),
  bisectReset: (path: string) => call<void>('bisectReset', path),
  /** Hand the search to a command — output streams via `window.api.onBisectOutput`. */
  bisectRunScript: (path: string, command: string) =>
    call<BisectStatus>('bisectRunScript', path, command),
  bisectCancel: (path: string) => call<boolean>('bisectCancel', path),
  createTag: (path: string, name: string, hash?: string, opts?: { message?: string; sign?: boolean }) =>
    call<void>('createTag', path, name, hash, opts),
  deleteTag: (path: string, name: string) => call<void>('deleteTag', path, name),
  pushTag: (path: string, name: string, remote?: string) => call<void>('pushTag', path, name, remote),
  deleteRemoteTag: (path: string, name: string, remote?: string) => call<void>('deleteRemoteTag', path, name, remote),
  getRemoteTags: (path: string, remote?: string) => call<string[]>('getRemoteTags', path, remote),

  diffFile: (path: string, file: string, staged: boolean, untracked: boolean, ignoreWs?: boolean) =>
    call<string>('diffFile', path, file, staged, untracked, ignoreWs),
  commitFiles: (path: string, hash: string) => call<FileEntry[]>('commitFiles', path, hash),
  stashFiles: (path: string, sha: string, untrackedSha?: string | null) =>
    call<FileEntry[]>('stashFiles', path, sha, untrackedSha),
  stashFileDiff: (path: string, sha: string, file: string, untracked?: boolean, ignoreWs?: boolean) =>
    call<string>('stashFileDiff', path, sha, file, untracked, ignoreWs),
  commitFileDiff: (path: string, hash: string, file: string, ignoreWs?: boolean) =>
    call<string>('commitFileDiff', path, hash, file, ignoreWs),
  formatPatch: (path: string, ref: string, count?: number) => call<string>('formatPatch', path, ref, count),
  applyPatch: (path: string, content: string, am?: boolean) => call<void>('applyPatch', path, content, am),
  stagedDiff: (path: string) => call<string>('stagedDiff', path),
  commitDiff: (path: string, hash: string) => call<string>('commitDiff', path, hash),
  commitBranches: (path: string, hash: string) => call<CommitBranchInfo[]>('commitBranches', path, hash),
  commitTags: (path: string, hash: string) => call<string[]>('commitTags', path, hash),

  fileContent: (path: string, file: string, ref?: string, force?: boolean) =>
    call<string>('fileContent', path, file, ref, force),
  searchFileContents: (
    path: string,
    files: string[],
    query: string,
    opts?: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }
  ) => call<string[]>('searchFileContents', path, files, query, opts),
  searchFileMatches: (
    path: string,
    files: string[],
    query: string,
    opts?: {
      caseSensitive?: boolean
      wholeWord?: boolean
      regex?: boolean
      max?: number
      maxPerFile?: number
      searchId?: string
    }
  ) => call<CodeSearchHit[]>('searchFileMatches', path, files, query, opts),
  searchCommitMatches: (
    path: string,
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
  ) => call<CodeSearchHit[]>('searchCommitMatches', path, rev, query, opts),
  grepWorkingTree: (
    path: string,
    query: string,
    opts?: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean; max?: number }
  ) => call<CodeSearchHit[]>('grepWorkingTree', path, query, opts),
  searchHistory: (
    path: string,
    query: string,
    opts?: { caseSensitive?: boolean; regex?: boolean; max?: number }
  ) => call<HistorySearchHit[]>('searchHistory', path, query, opts),
  fileDataUrl: (path: string, file: string, ref?: string, force?: boolean) =>
    call<string>('fileDataUrl', path, file, ref, force),
  repoImage: (path: string, file: string) => call<string | null>('repoImage', path, file),
  /** 'file' / 'dir' / null per repository-relative path in the working tree. */
  getWorkTreePathKinds: (path: string, paths: string[]) =>
    call<Array<'file' | 'dir' | null>>('getWorkTreePathKinds', path, paths),
  /** One image at a full commit id, capped — a pull request's Files tab, read here first. */
  getImageBlob: (path: string, sha: string, file: string) =>
    call<import('../../../shared/prImage').PrImageContent>('getImageBlob', path, sha, file),
  imageDiff: (path: string, file: string, beforeRef: string | null, afterRef?: string) =>
    call<{ before: string | null; after: string | null }>('imageDiff', path, file, beforeRef, afterRef),
  blameFile: (path: string, file: string, ref?: string) => call<BlameLine[]>('blameFile', path, file, ref),
  fileHistory: (path: string, file: string) => call<FileHistoryEntry[]>('fileHistory', path, file),

  worktrees: (path: string) => call<WorktreeInfo[]>('worktrees', path),
  worktreeRoot: (path: string) => call<string | null>('worktreeRoot', path),
  worktreeAdd: (path: string, dir: string, branch: string, newBranch: boolean, startPoint?: string) =>
    call<void>('worktreeAdd', path, dir, branch, newBranch, startPoint),
  worktreeRemove: (path: string, dir: string, force?: boolean) => call<void>('worktreeRemove', path, dir, force),
  getWorktreeStatus: (path: string, dir: string) => call<WorktreeStatus | null>('getWorktreeStatus', path, dir),
  worktreeLock: (path: string, dir: string, reason?: string) => call<void>('worktreeLock', path, dir, reason),
  worktreeUnlock: (path: string, dir: string) => call<void>('worktreeUnlock', path, dir),
  worktreePrune: (path: string) => call<number>('worktreePrune', path),
  worktreeMove: (path: string, from: string, to: string) => call<void>('worktreeMove', path, from, to),
  worktreeRepair: (path: string, dir: string) => call<void>('worktreeRepair', path, dir),

  submodules: (path: string) => call<SubmoduleInfo[]>('submodules', path),
  submoduleAdd: (path: string, url: string, dir: string, branch?: string) =>
    call<void>('submoduleAdd', path, url, dir, branch),
  submoduleUpdate: (path: string, dir?: string, init?: boolean) => call<void>('submoduleUpdate', path, dir, init),
  submoduleSync: (path: string, dir?: string) => call<void>('submoduleSync', path, dir),
  submoduleSetUrl: (path: string, name: string, url: string) => call<void>('submoduleSetUrl', path, name, url),
  submoduleDeinit: (path: string, dir: string, force?: boolean) => call<void>('submoduleDeinit', path, dir, force),
  submoduleRemove: (path: string, dir: string) => call<void>('submoduleRemove', path, dir),

  signingConfig: (path: string) => call<SigningConfig>('signingConfig', path),
  setSigningConfig: (path: string, opts: { sign?: boolean; format?: string; key?: string }) =>
    call<void>('setSigningConfig', path, opts),

  hooksInfo: (path: string) => call<HooksInfo>('hooksInfo', path),
  readHook: (path: string, name: string) => call<string>('readHook', path, name),
  writeHook: (path: string, name: string, content: string) => call<void>('writeHook', path, name, content),
  setHookEnabled: (path: string, name: string, enabled: boolean) =>
    call<void>('setHookEnabled', path, name, enabled),
  deleteHook: (path: string, name: string) => call<void>('deleteHook', path, name),

  lfsInfo: (path: string) => call<LfsInfo>('lfsInfo', path),
  lfsTrack: (path: string, pattern: string) => call<void>('lfsTrack', path, pattern),
  lfsUntrack: (path: string, pattern: string) => call<void>('lfsUntrack', path, pattern),
  lfsPull: (path: string) => call<void>('lfsPull', path),
  lfsPrune: (path: string) => call<void>('lfsPrune', path),

  sparseCheckoutInfo: (path: string) => call<SparseCheckoutInfo>('sparseCheckoutInfo', path),
  sparseCheckoutSet: (path: string, dirs: string[]) => call<void>('sparseCheckoutSet', path, dirs),
  sparseCheckoutDisable: (path: string) => call<void>('sparseCheckoutDisable', path),

  getUser: (path: string) => call<{ name: string; email: string }>('getUser', path),
  setUser: (path: string, name: string, email: string) => call<void>('setUser', path, name, email),

  clone: (parentDir: string, url: string, name: string, opts?: CloneOptions) =>
    call<string>('clone', parentDir, url, name, opts ?? {}),
  /** Abort a clone started with `opts.cloneId`; its half-written folder is removed. */
  cancelClone: (cloneId: string) => call<boolean>('cancelClone', cloneId),
  /** Progress for every running clone, tagged with its `cloneId`. Returns the unsubscribe. */
  onCloneProgress: (cb: (p: CloneProgress) => void): (() => void) => window.api.onCloneProgress(cb),
  /** Branch names a remote advertises — the clone dialog's branch picker. */
  /** `profileId`: the clone dialog's picked profile — a self-hosted server's token is read from it. */
  remoteBranches: (url: string, host?: RepoHost, token?: string, profileId?: string) =>
    call<string[]>('remoteBranches', url, host, token, profileId),
  init: (parentDir: string, name: string) => call<string>('init', parentDir, name),
  initHere: (path: string) => call<void>('initHere', path),

  mergeState: (path: string) => call<ConflictOpKind | null>('mergeState', path),
  mergeMessage: (path: string) => call<string>('mergeMessage', path),
  conflictContext: (path: string) => call<ConflictContext | null>('conflictContext', path),
  conflictVersions: (path: string, file: string) => call<ConflictVersions>('conflictVersions', path, file),
  resolveConflict: (path: string, file: string, content: string) => call<void>('resolveConflict', path, file, content),
  conflictTakeSide: (path: string, file: string, side: ConflictSide) => call<void>('conflictTakeSide', path, file, side),
  conflictOpContinue: (path: string, kind: ConflictOpKind) => call<void>('conflictOpContinue', path, kind),
  conflictOpAbort: (path: string, kind: ConflictOpKind) => call<void>('conflictOpAbort', path, kind),

  interactiveRebaseSteps: (path: string, base: string) =>
    call<{ hash: string; subject: string }[]>('interactiveRebaseSteps', path, base),
  runInteractiveRebase: (path: string, base: string, steps: RebaseStep[]) =>
    call<void>('runInteractiveRebase', path, base, steps),
  stagePatch: (path: string, patch: string) => call<void>('stagePatch', path, patch),
  applyHunkPatch: (
    path: string,
    patch: string,
    target: 'index' | 'worktree',
    reverse: boolean,
    ignoreWhitespace?: boolean
  ) => call<{ conflicts: number; merge?: string }>('applyHunkPatch', path, patch, target, reverse, ignoreWhitespace),
  restoreHunkMerge: (path: string, merge: string, side: 'before' | 'after') =>
    call<void>('restoreHunkMerge', path, merge, side),
  compareBranches: (path: string, a: string, b: string) =>
    call<BranchCompareResult>('compareBranches', path, a, b),
  refreshPrBase: (path: string, remote: string, target: string) =>
    call<boolean>('refreshPrBase', path, remote, target),
  prComparison: (path: string, source: string, target: string, remote: string) =>
    call<PrComparison>('prComparison', path, source, target, remote),
  mergePreview: (path: string, base: string, refs: string[]) =>
    call<MergePreviewResult>('mergePreview', path, base, refs),
  teammateRadar: (path: string) => call<TeammateRadarResult>('teammateRadar', path),
  stackPruneMerged: (path: string, alsoMerged?: string[], leaf?: string) =>
    call<string[]>('stackPruneMerged', path, alsoMerged, leaf),
  commitEditInfo: (path: string, sha: string) => call<CommitEditInfo>('commitEditInfo', path, sha),
  blobAtCommit: (path: string, sha: string, file: string) => call<BlobAtCommit>('blobAtCommit', path, sha, file),
  commitEditableFiles: (path: string, sha: string) => call<string[]>('commitEditableFiles', path, sha),
  commitEditPreview: (path: string, sha: string, edits: Record<string, string>, message: string) =>
    call<CommitEditPreview>('commitEditPreview', path, sha, edits, message),
  commitEditApply: (path: string, sha: string, edits: Record<string, string>, message: string) =>
    call<CommitEditResult>('commitEditApply', path, sha, edits, message),
  semanticDiff: (path: string, file: string, oldSide: BlobSpec, newSide: BlobSpec) =>
    call<SemanticDiff>('semanticDiff', path, file, oldSide, newSide),
  rangeDiff: (path: string, oldRev: string, newRev: string, base?: string) =>
    call<RangeDiffEntry[]>('rangeDiff', path, oldRev, newRev, base),
  refTips: (path: string, ref: string, max?: number) => call<RefTip[]>('refTips', path, ref, max),
  absorbPlan: (path: string) => call<AbsorbPlan>('absorbPlan', path),
  absorbApply: (path: string, opts?: { rebase?: boolean }) =>
    call<{ created: number; rebased: boolean }>('absorbApply', path, opts),
  repoStats: (path: string, sinceDays?: number) => call<RepoStats>('repoStats', path, sinceDays),
  repoInsights: (path: string, sinceDays?: number) => call<RepoInsights>('repoInsights', path, sinceDays),
  cosmosData: (path: string, limit?: number) => call<CosmosCommit[]>('cosmosData', path, limit),
  generateChangelog: (path: string, opts?: { from?: string; to?: string; version?: string }) =>
    call<ChangelogResult>('generateChangelog', path, opts),
  writeChangelogFile: (path: string, markdown: string) => call<void>('writeChangelogFile', path, markdown),
  createSnapshot: (path: string, kind?: SnapshotKind) => call<SnapshotInfo | null>('createSnapshot', path, kind),
  listSnapshots: (path: string) => call<SnapshotInfo[]>('listSnapshots', path),
  restoreSnapshot: (path: string, sha: string, files?: string[]) =>
    call<void>('restoreSnapshot', path, sha, files),
  deleteSnapshot: (path: string, ref: string) => call<void>('deleteSnapshot', path, ref)
}

/** Main answered a get/unlock with why it could not read the settings, not with defaults. */
export class SettingsLoadError extends Error {
  constructor(readonly kind: SettingsErrorKind) {
    super(`settings could not be loaded (${kind})`)
  }
}

/** Main refused a save without writing anything. */
export class SettingsSaveRefused extends Error {
  constructor(readonly reason: SettingsRefusal) {
    super(`settings save refused (${reason})`)
  }
}

async function settingsReply(pending: Promise<unknown>): Promise<SettingsReply> {
  const reply = (await pending) as SettingsReplyWire
  if ('error' in reply) throw new SettingsLoadError(reply.error)
  return reply
}

export const settingsApi = {
  get: () => settingsReply(window.api.settings.get()),
  // Decrypts the stored tokens (asking for keychain access if needed) and
  // returns the settings with them filled in. Only call it from an explicit
  // user action — never on start-up.
  unlock: () => settingsReply(window.api.settings.unlock()),
  // `generation` is the one of the reply the settings were built from: a blank
  // token clears the saved one only when it is still current (main/settings.ts).
  // A save main would not write at all rejects with `SettingsSaveRefused`.
  set: async (s: AppSettings, generation: number, options?: SettingsSaveOptions): Promise<void> => {
    const out = (await window.api.settings.set(s, generation, options)) as { refused?: SettingsRefusal } | undefined
    if (out?.refused) throw new SettingsSaveRefused(out.refused)
  },
  /** Renames an unparseable settings file aside; see `MoveAsideReply` for what else it can answer. */
  moveAside: () => window.api.settings.moveAside() as Promise<MoveAsideReply>,
  /** Whether a saved token store exists that this session could not read. */
  secretsState: () => window.api.settings.secretsState() as Promise<SecretsState>,
  /** Start a new token store over an unreadable one, keeping the old file as a backup. */
  replaceUnreadableStore: () => window.api.settings.replaceUnreadableStore(),
  importFile: () => window.api.settings.importFile() as Promise<unknown>,
  exportFile: (data: unknown, password?: string) => window.api.settings.exportFile(data, password),
  decryptImport: (raw: unknown, password: string) =>
    window.api.settings.decryptImport(raw, password) as Promise<SettingsDecryptResult>
}

/** Settings → About: earlier versions, the switch to one, and the settings copies taken on the way. */
export const rollbackApi = {
  releases: () => window.api.rollback.releases(),
  support: () => window.api.rollback.support(),
  getState: () => window.api.rollback.getState(),
  start: (version: string) => window.api.rollback.start(version),
  /** Quits and installs the downloaded version. Only after the switch is recorded and flushed. */
  install: () => window.api.rollback.install(),
  cancel: () => window.api.rollback.cancel(),
  onEvent: (cb: (state: RollbackState) => void) => window.api.rollback.onEvent(cb),
  appVersion: () => window.api.appVersion()
}

export const settingsBackupsApi = {
  list: () => window.api.settingsBackups.list(),
  restore: (name: string) => window.api.settingsBackups.restore(name),
  changedSince: (name: string) => window.api.settingsBackups.changedSince(name),
  /** Shows the copy in the file manager; without a name, the folder. */
  reveal: (name?: string) => window.api.settingsBackups.reveal(name)
}

export interface ArtifactRequest {
  path: string
  description: string
}

export interface GeneratedFile {
  path: string
  content: string
}

export interface ArtifactSuggestion {
  path: string
  description: string
  reason: string
}

/**
 * How an AI call answers a cancel, a switch of account or a dead local server.
 * Registered by AIRequestPrompt once it mounts: the prompts and their wording
 * live in the renderer, and importing them here would loop back through the
 * settings store. Until then (and in tests) a call simply runs.
 */
let aiGuardDeps: GuardDeps | null = null
export function setAIGuardDeps(deps: GuardDeps | null): void {
  aiGuardDeps = deps
}
function guarded<T>(cfg: AIConfig, call: (cfg: AIConfig) => Promise<T>): Promise<T> {
  return aiGuardDeps ? guardAI(cfg, call, aiGuardDeps) : call(cfg)
}

export const aiApi = {
  /**
   * `ctx.requestTag` names the generation so `cancelRequest` can end it in main;
   * `onAttempt` hears each config actually tried — the slow prompt's "use
   * another account" re-runs the call elsewhere — and may throw to stop a retry.
   */
  commitMessage: (
    diff: string,
    cfg: AIConfig,
    ctx: { branch: string; requestTag?: string },
    onAttempt?: (cfg: AIConfig) => void
  ) =>
    guarded(cfg, (c) => {
      onAttempt?.(c)
      return window.api.ai.commitMessage(diff, c, ctx) as Promise<{ summary: string; description: string }>
    }),
  /** Ends a tagged generation in main: its in-flight call and any retry it would make. */
  cancelRequest: (tag: string) => window.api.ai.cancelRequest(tag) as Promise<void>,
  listModels: (cfg: AIConfig, force = false) => window.api.ai.listModels(cfg, force) as Promise<ModelCatalog>,
  signInSubscription: (binary: SubscriptionCli, path: string, requestId: string) =>
    window.api.ai.signInSubscription(binary, path, requestId) as Promise<SubscriptionTest>,
  cancelSubscriptionSignIn: (requestId: string) => window.api.ai.cancelSubscriptionSignIn(requestId),
  testSubscription: (binary: SubscriptionCli, path: string) =>
    window.api.ai.testSubscription(binary, path) as Promise<SubscriptionTest>,
  /** `versions` also runs each found CLI's `--version` — one spawn per CLI, so only where it is shown. */
  detectCli: (opts?: { versions?: boolean }) => window.api.ai.detectCli(opts) as Promise<DetectedCli[]>,
  explainCode: (code: string, lang: string, cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.explainCode(code, lang, c) as Promise<string>),
  editSelection: (req: EditSelectionRequest, cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.editSelection(req, c) as Promise<string>),
  hoverExplain: (req: HoverExplainRequest, cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.hoverExplain(req, c) as Promise<HoverExplainResult>),
  resolveConflict: (file: string, content: string, cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.resolveConflict(file, content, c) as Promise<string>),
  generateConfig: (repoName: string, artifacts: ArtifactRequest[], context: string, cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.generateConfig(repoName, artifacts, context, c) as Promise<{ files: GeneratedFile[] }>),
  suggestArtifacts: (repoName: string, selectedTools: string[], context: string, alreadySelected: ArtifactRequest[], cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.suggestArtifacts(repoName, selectedTools, context, alreadySelected, c) as Promise<{ suggestions: ArtifactSuggestion[] }>),
  smartStage: (files: { path: string; status: string }[], cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.smartStage(files, c) as Promise<{ toStage: string[]; reason: string }>),
  generateAppTheme: (prompt: string, cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.generateAppTheme(prompt, c) as Promise<{ name: string; light: AppThemeColors; dark: AppThemeColors }>),
  generateCodeTheme: (prompt: string, cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.generateCodeTheme(prompt, c) as Promise<{ name: string; light: CodeThemeColors; dark: CodeThemeColors }>),
  generateGraphPalette: (prompt: string, cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.generateGraphPalette(prompt, c) as Promise<{ name: string; colors: string[] }>),
  generateBranchName: (description: string, cfg: AIConfig, ctx: { username?: string }) =>
    guarded(cfg, (c) => window.api.ai.generateBranchName(description, c, ctx) as Promise<string>),
  reviewPR: (diff: string, cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.reviewPR(diff, c) as Promise<PRReviewResult>),
  prDescription: (commits: string, diff: string, cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.prDescription(commits, diff, c) as Promise<{ title: string; body: string }>),
  planActions: (prompt: string, status: RepoStatus, cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.ai.planActions(prompt, status, c) as Promise<AskPlan>),
  repoChat: (
    repoPath: string,
    messages: RepoChatMessage[],
    cfg: AIConfig,
    attachments: RepoChatAttachment[] = []
  ) => guarded(cfg, (c) => window.api.ai.repoChat(repoPath, messages, c, attachments) as Promise<RepoChatReply>),
  repoChatFinalize: (
    repoPath: string,
    messages: RepoChatMessage[],
    result: RepoChatExecutionResult,
    cfg: AIConfig
  ) => guarded(cfg, (c) => window.api.ai.repoChatFinalize(repoPath, messages, result, c) as Promise<RepoChatReply>),
  /** What a pending chat request is doing — thinking, or reading files it asked for. */
  onRepoChatProgress: (cb: (p: RepoChatProgress) => void): (() => void) => window.api.ai.onRepoChatProgress(cb),
  /** A call has been running long (or ended after being announced). */
  onRequestEvent: (cb: (event: AIRequestEvent) => void): (() => void) => window.api.ai.onRequestEvent(cb),
  answerSlow: (id: number, choice: AISlowChoice) => window.api.ai.answerSlow(id, choice) as Promise<void>
}

export const wikiApi = {
  facts: (repoPath: string) => window.api.wiki.facts(repoPath) as Promise<RepoFacts>,
  imports: (repoPath: string, depth: number) => window.api.wiki.imports(repoPath, depth) as Promise<ImportGraph>,
  get: (repoPath: string, model: string) =>
    window.api.wiki.get(repoPath, model) as Promise<{
      wiki: RepoWiki | null
      freshness: 'current' | 'behind' | 'outdated'
      headSha: string
    }>,
  generate: (repoPath: string, cfg: AIConfig) =>
    guarded(cfg, (c) => window.api.wiki.generate(repoPath, c) as Promise<RepoWiki>),
  export: (repoPath: string) => window.api.wiki.export(repoPath) as Promise<string[]>,
  clear: (repoPath: string) => window.api.wiki.clear(repoPath) as Promise<void>,
  onProgress: (cb: (payload: { repoPath: string; progress: WikiProgress }) => void) =>
    window.api.wiki.onProgress(cb as (payload: unknown) => void)
}

export const analyticsApi = {
  get: () => window.api.analytics.get() as Promise<Analytics>,
  clear: () => window.api.analytics.clear() as Promise<Analytics>,
  setRetention: (days: number) => window.api.analytics.setRetention(days) as Promise<Analytics>
}

export const logApi = {
  get: () => window.api.log.get() as Promise<LogEntry[]>,
  clear: () => window.api.log.clear() as Promise<LogEntry[]>
}

/** Profile pictures stored as images (main/profileAvatar.ts). */
export const profileAvatarApi = {
  get: (id: string) => window.api.profileAvatar.get(id) as Promise<string | null>,
  /** The new picture as a data URL; null when cancelled; `{ error }` when unreadable or too large.
   *  `title` and `filterName` label the native file dialog, so they arrive translated. */
  pick: (id: string, title: string, filterName: string) =>
    window.api.profileAvatar.pick(id, title, filterName) as Promise<string | null | { error: string }>,
  setData: (id: string, dataUrl: string) =>
    window.api.profileAvatar.setData(id, dataUrl) as Promise<string | { error: string }>,
  remove: (id: string) => window.api.profileAvatar.remove(id) as Promise<void>,
  exportAll: (ids: string[]) => window.api.profileAvatar.exportAll(ids) as Promise<Record<string, string>>,
  importAll: (data: Record<string, string>) => window.api.profileAvatar.importAll(data) as Promise<number>
}

/** GitHub pictures for commit authors and the active profile (main/avatars.ts). */
export const avatarApi = {
  /** By lowercased email: a URL, `null` for a confirmed miss; an absent email is unknown for now. */
  github: (remoteUrl: string, repoPath: string, items: { email: string; sha?: string }[], size: number) =>
    window.api.avatars.github(remoteUrl, repoPath, items, size) as Promise<Record<string, string | null>>,
  profileGithub: (profileId: string, size: number) =>
    window.api.avatars.profileGithub(profileId, size) as Promise<string | null>
}

export const vaultApi = {
  list: (repoPath: string) => window.api.vault.list(repoPath) as Promise<VaultListResult>,
  upsert: (scope: 'repo' | 'global', repoPath: string, entry: Partial<VaultEntry>) =>
    window.api.vault.upsert(scope, repoPath, entry) as Promise<VaultListResult>,
  remove: (scope: 'repo' | 'global', repoPath: string, id: string) =>
    window.api.vault.remove(scope, repoPath, id) as Promise<VaultListResult>,
  exportAll: () => window.api.vault.exportAll() as Promise<VaultExportReply>,
  importAll: (data: VaultExport) => window.api.vault.importAll(data) as Promise<VaultImportReply>,
  replaceUnreadable: () => window.api.vault.replaceUnreadable() as Promise<boolean>
}

export const reposApi = {
  list: () => window.api.repos.list() as Promise<RegistryRepo[]>,
  remember: (repoPath: string) => window.api.repos.remember(repoPath) as Promise<RegistryRepo[]>,
  forget: (repoPath: string) => window.api.repos.forget(repoPath) as Promise<RegistryRepo[]>,
  scan: (rootList: RepoScanRoot[]) => window.api.repos.scan(rootList) as Promise<RepoScanResult>,
  locate: (oldPath: string, newPath: string) =>
    window.api.repos.locate(oldPath, newPath) as Promise<RegistryRepo[]>,
  refresh: (paths: string[]) => window.api.repos.refresh(paths) as Promise<RegistryRepo[]>
}

export const secureShareApi = {
  candidates: (repoPath: string) =>
    window.api.secureShare.candidates(repoPath) as Promise<SecureShareCandidate[]>,
  export: (repoPath: string, project: string, paths: string[], password: string) =>
    window.api.secureShare.export(repoPath, project, paths, password) as Promise<
      { path: string } | { canceled: true } | { error: SecureShareError }
    >,
  pick: () =>
    window.api.secureShare.pick() as Promise<
      { path: string; header: SecureBundleHeader } | { error: SecureShareError } | null
    >,
  preview: (bundlePath: string, password: string, repoPath: string) =>
    window.api.secureShare.preview(bundlePath, password, repoPath) as Promise<
      { files: SecureSharePreviewEntry[] } | { error: SecureShareError }
    >,
  apply: (bundlePath: string, password: string, repoPath: string, selected: string[]) =>
    window.api.secureShare.apply(bundlePath, password, repoPath, selected) as Promise<
      { written: string[] } | { error: SecureShareError }
    >,
  exportV2: (specs: SecureExportSpec[], project: string, password: string) =>
    window.api.secureShare.exportV2(specs, project, password) as Promise<
      { path: string } | { canceled: true } | { error: SecureShareError }
    >,
  openV2: (bundlePath: string, password: string) =>
    window.api.secureShare.openV2(bundlePath, password) as Promise<
      SecureBundleOpened | { error: SecureShareError }
    >,
  previewRepoV2: (bundlePath: string, password: string, sectionIndex: number, repoPath: string) =>
    window.api.secureShare.previewRepoV2(bundlePath, password, sectionIndex, repoPath) as Promise<
      { files: SecureSharePreviewEntry[] } | { error: SecureShareError }
    >,
  applyV2: (bundlePath: string, password: string, plan: SecureApplyPlan[]) =>
    window.api.secureShare.applyV2(bundlePath, password, plan) as Promise<
      SecureApplyResult | { error: SecureShareError }
    >,
  previewNotesV2: (bundlePath: string, password: string, sectionIndex: number, repoPath: string) =>
    window.api.secureShare.previewNotesV2(bundlePath, password, sectionIndex, repoPath) as Promise<
      { notes: import('../../../shared/types').SecureNotePreviewEntry[] } | { error: SecureShareError }
    >
}

/** Settings → Environment: what the app relies on outside its bundle. */
export const envApi = {
  check: () => window.api.env.check() as Promise<EnvCheck[]>,
  checkNetwork: () => window.api.env.checkNetwork() as Promise<EnvCheck[]>
}

/** Existence only — main never reveals what a path holds. Used by the
 *  selective settings import to keep the repositories present on this machine. */
export const fsApi = {
  pathsExist: (paths: string[]) => window.api.fs.pathsExist(paths) as Promise<boolean[]>,
  homeDir: () => window.api.fs.homeDir() as Promise<string>
}

export const infoApi = {
  list: (repoPath: string) => window.api.info.list(repoPath) as Promise<InfoEntry[]>,
  upsert: (repoPath: string, entry: Partial<InfoEntry>) =>
    window.api.info.upsert(repoPath, entry) as Promise<InfoEntry[]>,
  remove: (repoPath: string, id: string) =>
    window.api.info.remove(repoPath, id) as Promise<InfoEntry[]>,
  reorder: (repoPath: string, ids: string[]) =>
    window.api.info.reorder(repoPath, ids) as Promise<InfoEntry[]>,
  exportAll: () => window.api.info.exportAll() as Promise<InfoExport>,
  importAll: (data: InfoExport) => window.api.info.importAll(data) as Promise<void>
}

export const testsApi = {
  detect: (repoPath: string) => window.api.tests.detect(repoPath),
  run: (repoPath: string) => window.api.tests.run(repoPath),
  cancel: (repoPath: string) => window.api.tests.cancel(repoPath)
}

export const shellApi = {
  selectDirectory: (title?: string) => window.api.selectDirectory(title),
  selectDirectories: (title?: string) => window.api.selectDirectories(title),
  revealInFolder: (fullPath: string) => window.api.shell.showItemInFolder(fullPath),
  openPath: (fullPath: string) => window.api.shell.openPath(fullPath),
  openWithPicker: (fullPath: string) => window.api.shell.openWithPicker(fullPath),
  pickApplication: () => window.api.shell.pickApplication(),
  /** Launches a specific app (e.g. VS Code) with the given file/folder path —
   *  the equivalent of running `code <path>` from a terminal. */
  openWithApp: (targetPath: string, appPath: string) => window.api.shell.openWithApp(targetPath, appPath),
  openExternal: (url: string) => window.api.openExternal(url),
  writeFiles: (repoPath: string, files: GeneratedFile[]) =>
    window.api.shell.writeFiles(repoPath, files) as Promise<void>,
  // A key, not the label: this object is built once at import, and a string
  // here would stay in whatever language was active then.
  revealLabelKey: (window.api.platform === 'darwin'
    ? 'repoMenu.revealFinder'
    : window.api.platform === 'win32'
      ? 'repoMenu.revealExplorer'
      : 'repoMenu.revealFileManager') as TranslationKey
}

export const localCiApi = {
  status: () => window.api.localci.status() as Promise<LocalCiStatus>,
  workflows: (repoPath: string) => window.api.localci.workflows(repoPath) as Promise<LocalCiWorkflow[]>,
  /** Resolves with act's exit code (0 = green), null when cancelled. */
  run: (repoPath: string, workflowFile: string) =>
    window.api.localci.run(repoPath, workflowFile) as Promise<number | null>,
  cancel: (repoPath: string) => window.api.localci.cancel(repoPath) as Promise<void>,
  /** Pin a run's verdict to HEAD (clean tree only). */
  record: (repoPath: string, workflowFile: string, ok: boolean) =>
    window.api.localci.record(repoPath, workflowFile, ok) as Promise<{ recorded: boolean; sha: string }>,
  verdicts: (repoPath: string) => window.api.localci.verdicts(repoPath) as Promise<Record<string, LocalCiVerdict>>,
  /** Run one workflow against a commit you are not on, via a throwaway worktree. */
  runAt: (repoPath: string, workflowFile: string, sha: string) =>
    window.api.localci.runAt(repoPath, workflowFile, sha) as Promise<{
      sha: string
      exit: number | null
      ok: boolean
      recorded: boolean
    }>,
  /** What a range spec would run: total matched, plus the capped newest-first head. */
  resolveRange: (repoPath: string, spec: string, limit: number) =>
    window.api.localci.resolveRange(repoPath, spec, limit) as Promise<{
      total: number
      shas: string[]
      subjects: Record<string, string>
    }>,
  sweep: (repoPath: string, workflowFile: string, shas: string[]) =>
    window.api.localci.sweep(repoPath, workflowFile, shas) as Promise<LocalCiSweepResult>,
  onData: (cb: (p: { repoPath: string; chunk: string }) => void) => window.api.localci.onData(cb),
  onSweepProgress: (cb: (p: LocalCiSweepProgress) => void) =>
    window.api.localci.onSweepProgress(cb as (p: unknown) => void)
}

export const diffToolApi = {
  /** Tools git knows about here, plus the currently configured choices. */
  config: (repoPath: string) => window.api.difftool.config(repoPath),
  set: (
    repoPath: string,
    values: { diffTool?: string; mergeTool?: string; keepBackup?: boolean },
    scope: 'global' | 'repo' = 'global'
  ) => window.api.difftool.set(repoPath, values, scope),
  /** Resolves when the tool exits — '' on success, else git's complaint. */
  diff: (repoPath: string, file: string, rev?: string, tool?: string) =>
    window.api.difftool.diff(repoPath, file, rev, tool),
  merge: (repoPath: string, file: string, tool?: string) => window.api.difftool.merge(repoPath, file, tool)
}

export const sshApi = {
  /** Keys in ~/.ssh, with whether the agent is holding each one. Public halves
   *  and fingerprints only — a private key never crosses this boundary. */
  status: () => window.api.ssh.status(),
  generate: (name: string, comment: string, passphrase: string) =>
    window.api.ssh.generate(name, comment, passphrase),
  /** Resolves to '' on success, or to ssh-add's own complaint. */
  addToAgent: (publicKeyPath: string, passphrase: string) =>
    window.api.ssh.addToAgent(publicKeyPath, passphrase),
  test: (host: string) => window.api.ssh.test(host)
}

export const editorApi = {
  /** Editors installed on this machine, CLI installs first (only those can jump
   *  to a line). Re-probed on demand — an editor installed after launch shows up
   *  without restarting GitHuttBr. */
  detect: () => window.api.editor.detect(),
  /** Opens `target` in the configured editor. Resolves to '' on success, or to
   *  the failure message. */
  open: (setting: EditorSetting, target: EditorTarget) => window.api.editor.open(setting, target)
}

type PrTokens = { github?: string; gitlab?: string; forgejo?: string; azure?: string }
type HostTokens = PrTokens & { bitbucket?: string }

/**
 * Hosting calls. Two kinds:
 *
 * - Provider-level (`listRepos`, `listOwners`, `createRepo`): no repository yet.
 *   `profileId` is the dialog's picked profile — the list, the clone and the new
 *   repository's binding all use it; absent means the active profile.
 * - Repository-scoped (everything taking `repoPath` first): the repository the
 *   call acts for. Main runs it as the profile that repository is bound to
 *   (see shared/hostToken.ts), so the path is required, never optional.
 */
export const hostingApi = {
  listRepos: (provider: RepoHost, token: string, org?: string, profileId?: string) =>
    window.api.hosting.listRepos(provider, token, org, profileId) as Promise<RemoteRepo[]>,
  listOwners: (provider: RepoHost, token: string, org?: string, profileId?: string) =>
    window.api.hosting.listOwners(provider, token, org, profileId) as Promise<RemoteOwner[]>,
  /** Name of another profile already holding this account (link or token), else null. */
  accountOwner: (provider: RepoHost, login: string, found: AccountLink, exceptProfileId: string) =>
    window.api.hosting.accountOwner(provider, login, found, exceptProfileId) as Promise<string | null>,
  /**
   * The account behind a token, or why there is none — refused, unreachable, or
   * another error — as main classified it (shared/tokenCheck.ts). The account is
   * null when the profile has neither a token nor a link and no sign-in was asked for.
   */
  checkToken: (provider: RepoHost, token: string, org?: string, interactive?: boolean, link?: AccountLink, issuer?: string) =>
    window.api.hosting.whoAmI(provider, token, org, interactive, link, issuer) as Promise<TokenCheckResult>,
  /** `checkToken` for a caller that only wants the account: a failure rejects with its message. */
  whoAmI: async (
    provider: RepoHost,
    token: string,
    org?: string,
    interactive?: boolean,
    link?: AccountLink,
    issuer?: string
  ): Promise<ConnectedAccount | null> => {
    const result = (await window.api.hosting.whoAmI(provider, token, org, interactive, link, issuer)) as TokenCheckResult
    if (!result.ok) throw new Error(result.failure.message)
    return result.account
  },
  createRepo: (provider: RepoHost, token: string, opts: CreateRepoOpts, org?: string, profileId?: string) =>
    window.api.hosting.createRepo(provider, token, opts, org, profileId) as Promise<RemoteRepo>,
  listPRs: (repoPath: string, remoteUrl: string, tokens: HostTokens) =>
    window.api.hosting.listPRs(repoPath, remoteUrl, tokens) as Promise<{
      provider: HostingProvider
      prs: PullRequest[]
      /** Who this repository's calls sign in as on the host; null when unknown. */
      me?: string | null
    }>,
  /** Merged and closed PRs, newest activity first, bounded (see FinishedPullRequests). */
  listFinishedPRs: (repoPath: string, remoteUrl: string, tokens: HostTokens) =>
    window.api.hosting.listFinishedPRs(repoPath, remoteUrl, tokens) as Promise<FinishedPullRequests>,
  listReleases: (repoPath: string, remoteUrl: string, tokens: { github?: string }) =>
    window.api.hosting.listReleases(repoPath, remoteUrl, tokens) as Promise<{ provider: HostingProvider; releases: ReleaseInfo[] }>,
  ciStatuses: (repoPath: string, remoteUrl: string, shas: string[], token: string) =>
    window.api.hosting.ciStatuses(repoPath, remoteUrl, shas, token) as Promise<Record<string, CiStatus>>,
  /** Whether a hosting action on this remote has a credential — main peeks, never decrypts. */
  canAct: (repoPath: string, remoteUrl: string) =>
    window.api.hosting.canAct(repoPath, remoteUrl) as Promise<HostingAccess>,
  openCreatePR: (remoteUrl: string, source: string, target: string) =>
    window.api.hosting.openCreatePR(remoteUrl, source, target),
  createPR: (repoPath: string, remoteUrl: string, tokens: HostTokens, opts: CreatePrOpts) =>
    window.api.hosting.createPR(repoPath, remoteUrl, tokens, opts) as Promise<CreatePrResult>,
  /** Which of reviewers / assignees / labels the host takes, and the choices for each. */
  prPickerOptions: (repoPath: string, remoteUrl: string, tokens: HostTokens) =>
    window.api.hosting.prPickerOptions(repoPath, remoteUrl, tokens) as Promise<PrPickerOptions>,
  prDetail: (repoPath: string, remoteUrl: string, tokens: PrTokens, number: number) =>
    window.api.hosting.prDetail(repoPath, remoteUrl, tokens, number) as Promise<PrDetail>,
  workItem: (repoPath: string, remoteUrl: string, tokens: { azure?: string }, id: number) =>
    window.api.hosting.workItem(repoPath, remoteUrl, tokens, id) as Promise<{ id: number; title: string; type: string; state?: string }>,
  /** Titles for `#12` / `!12` / `AB#12` references, one entry per query; never throws for a missing id. */
  getReferenceSummaries: (repoPath: string, remoteUrl: string, tokens: PrTokens, queries: ReferenceQuery[]) =>
    window.api.hosting.getReferenceSummaries(repoPath, remoteUrl, tokens, queries) as Promise<ReferenceSummary[]>,
  prComment: (repoPath: string, remoteUrl: string, tokens: PrTokens, number: number, body: string) =>
    window.api.hosting.prComment(repoPath, remoteUrl, tokens, number, body) as Promise<void>,
  prReplyReviewComment: (
    repoPath: string,
    remoteUrl: string,
    tokens: PrTokens,
    number: number,
    inReplyTo: number | string,
    body: string
  ) => window.api.hosting.prReplyReviewComment(repoPath, remoteUrl, tokens, number, inReplyTo, body) as Promise<void>,
  /**
   * GitHub: reply in a review thread whose first comment is gone, through a comment still in it.
   * `pending`: the reply landed in the viewer's pending review, unseen until it is submitted.
   */
  prReplyReviewThread: (
    repoPath: string,
    remoteUrl: string,
    tokens: PrTokens,
    number: number,
    commentId: number,
    body: string
  ) =>
    window.api.hosting.prReplyReviewThread(repoPath, remoteUrl, tokens, number, commentId, body) as Promise<{ pending: boolean }>,
  /** Start a review thread on one line of the PR's diff, posted at once. */
  prCommentOnLine: (
    repoPath: string,
    remoteUrl: string,
    tokens: PrTokens,
    number: number,
    anchor: import('../../../shared/types').PrLineAnchor,
    body: string,
    /** The revision the Files tab's diff was read at; null when the host did not say. */
    revision: import('../../../shared/types').PrDiffRevision | null
  ) => window.api.hosting.prCommentOnLine(repoPath, remoteUrl, tokens, number, anchor, body, revision) as Promise<void>,
  /** Replace the text of one of the PR's (or issue's) comments, reached through its handle. */
  prEditComment: (
    repoPath: string,
    remoteUrl: string,
    tokens: PrTokens,
    number: number,
    handle: import('../../../shared/types').PrCommentHandle,
    body: string
  ) => window.api.hosting.prEditComment(repoPath, remoteUrl, tokens, number, handle, body) as Promise<void>,
  /** Delete one of the PR's (or issue's) comments on the host. It cannot be restored. */
  prDeleteComment: (
    repoPath: string,
    remoteUrl: string,
    tokens: PrTokens,
    number: number,
    handle: import('../../../shared/types').PrCommentHandle
  ) => window.api.hosting.prDeleteComment(repoPath, remoteUrl, tokens, number, handle) as Promise<void>,
  /** A check's log text, or null when the app cannot read it (open it in the browser instead). */
  ciRuns: (repoPath: string, remoteUrl: string, tokens: PrTokens, branch?: string) =>
    window.api.hosting.ciRuns(repoPath, remoteUrl, tokens, branch) as Promise<import('../../../shared/types').CiRunList>,
  ciRunJobs: (repoPath: string, remoteUrl: string, tokens: PrTokens, runId: string) =>
    window.api.hosting.ciRunJobs(repoPath, remoteUrl, tokens, runId) as Promise<import('../../../shared/types').CiRunJob[]>,
  ciJobLog: (repoPath: string, remoteUrl: string, tokens: PrTokens, runId: string, jobId: string) =>
    window.api.hosting.ciJobLog(repoPath, remoteUrl, tokens, runId, jobId) as Promise<string | null>,
  ciRunAction: (repoPath: string, remoteUrl: string, tokens: PrTokens, runId: string, action: import('../../../shared/types').CiRunAction) =>
    window.api.hosting.ciRunAction(repoPath, remoteUrl, tokens, runId, action) as Promise<void>,
  ciWorkflows: (repoPath: string, remoteUrl: string, tokens: PrTokens) =>
    window.api.hosting.ciWorkflows(repoPath, remoteUrl, tokens) as Promise<import('../../../shared/types').CiWorkflow[]>,
  ciDispatch: (repoPath: string, remoteUrl: string, tokens: PrTokens, workflowId: string, ref: string) =>
    window.api.hosting.ciDispatch(repoPath, remoteUrl, tokens, workflowId, ref) as Promise<void>,
  /** The merge base and head a pull request's Files tab compares — what its image preview reads at. */
  prDiffCommits: (repoPath: string, remoteUrl: string, tokens: PrTokens, number: number) =>
    window.api.hosting.prDiffCommits(repoPath, remoteUrl, tokens, number) as Promise<
      import('../../../shared/prImage').PrDiffCommits | null
    >,
  /** One image at one commit, from the host — when this clone lacks the commit. */
  prFileContent: (repoPath: string, remoteUrl: string, tokens: PrTokens, sha: string, path: string) =>
    window.api.hosting.prFileContent(repoPath, remoteUrl, tokens, sha, path) as Promise<
      import('../../../shared/prImage').PrImageContent
    >,
  prCheckLog: (repoPath: string, remoteUrl: string, tokens: PrTokens, url: string) =>
    window.api.hosting.prCheckLog(repoPath, remoteUrl, tokens, url) as Promise<string | null>,
  prChecks: (repoPath: string, remoteUrl: string, tokens: PrTokens, number: number) =>
    window.api.hosting.prChecks(repoPath, remoteUrl, tokens, number) as Promise<import('../../../shared/types').PrCheck[]>,
  /** `fetchMode`: whether the list may fetch the PR's missing commits — `once` on first load, `refresh` on Refresh. */
  prFiles: (
    repoPath: string,
    remoteUrl: string,
    tokens: PrTokens,
    number: number,
    fetchMode: import('../../../shared/types').PrFilesFetchMode = 'none'
  ) => window.api.hosting.prFiles(repoPath, remoteUrl, tokens, number, fetchMode) as Promise<import('../../../shared/types').PrFileList>,
  /** Told when the Files tab's quiet fetch of a PR's commits starts and ends. Returns the unsubscribe. */
  onPrFilesFetching: (cb: (p: import('../../../shared/types').PrFilesFetching) => void): (() => void) =>
    window.api.hosting.onPrFilesFetching(cb as (p: unknown) => void),
  /** One file's diff read on demand — this clone first, then the host. Always the file back, with a reason when still no patch. */
  prFileDiff: (repoPath: string, remoteUrl: string, tokens: PrTokens, request: import('../../../shared/types').PrFileDiffRequest) =>
    window.api.hosting.prFileDiff(repoPath, remoteUrl, tokens, request) as Promise<import('../../../shared/types').PrFile>,
  prListCommits: (repoPath: string, remoteUrl: string, tokens: PrTokens, number: number) =>
    window.api.hosting.prListCommits(repoPath, remoteUrl, tokens, number) as Promise<import('../../../shared/types').PrCommitList>,
  prListUpdates: (repoPath: string, remoteUrl: string, tokens: PrTokens, number: number) =>
    window.api.hosting.prListUpdates(repoPath, remoteUrl, tokens, number) as Promise<import('../../../shared/types').PrUpdateList>,
  /** The changes one update made, from the host; null when the host cannot diff two commits. */
  prUpdateFiles: (
    repoPath: string,
    remoteUrl: string,
    tokens: PrTokens,
    number: number,
    from: import('../../../shared/types').PrUpdateEnd,
    to: import('../../../shared/types').PrUpdateEnd
  ) =>
    window.api.hosting.prUpdateFiles(repoPath, remoteUrl, tokens, number, from, to) as Promise<
      import('../../../shared/types').PrUpdateFiles | null
    >,
  prReview: (repoPath: string, remoteUrl: string, tokens: PrTokens, number: number, event: PrReviewEvent, body: string) =>
    window.api.hosting.prReview(repoPath, remoteUrl, tokens, number, event, body) as Promise<void>,
  prMerge: (repoPath: string, remoteUrl: string, tokens: PrTokens, number: number, method: PrMergeMethod) =>
    window.api.hosting.prMerge(repoPath, remoteUrl, tokens, number, method) as Promise<void>,
  /** Closes a pull request without merging it, or reopens a closed one. */
  prSetState: (repoPath: string, remoteUrl: string, tokens: PrTokens, number: number, state: 'open' | 'closed') =>
    window.api.hosting.prSetState(repoPath, remoteUrl, tokens, number, state) as Promise<void>,
  /** Moves a pull request to draft, or marks a draft ready for review. */
  prSetDraft: (repoPath: string, remoteUrl: string, tokens: PrTokens, number: number, draft: boolean) =>
    window.api.hosting.prSetDraft(repoPath, remoteUrl, tokens, number, draft) as Promise<void>,
  listNotifications: (token: string, all?: boolean) =>
    window.api.hosting.listNotifications(token, all) as Promise<GitHubNotification[]>,
  markNotificationRead: (token: string, id: string) =>
    window.api.hosting.markNotificationRead(token, id) as Promise<void>,
  markAllNotificationsRead: (token: string) =>
    window.api.hosting.markAllNotificationsRead(token) as Promise<void>,
  listIssues: (repoPath: string, remoteUrl: string, tokens: { github?: string }) =>
    window.api.hosting.listIssues(repoPath, remoteUrl, tokens) as Promise<{ provider: HostingProvider; issues: IssueInfo[] }>,
  /** Register a public key on the user's GitHub account (GitHub only). */
  uploadSshKey: (token: string, title: string, publicKey: string) =>
    window.api.hosting.uploadSshKey(token, title, publicKey) as Promise<{ id: number }>,
  issueDetail: (repoPath: string, remoteUrl: string, tokens: { github?: string }, number: number) =>
    window.api.hosting.issueDetail(repoPath, remoteUrl, tokens, number) as Promise<IssueDetail>,
  setIssueState: (
    repoPath: string,
    remoteUrl: string,
    tokens: { github?: string },
    number: number,
    state: 'open' | 'closed'
  ) => window.api.hosting.setIssueState(repoPath, remoteUrl, tokens, number, state) as Promise<void>,
  createIssue: (repoPath: string, remoteUrl: string, tokens: { github?: string }, opts: { title: string; body?: string }) =>
    window.api.hosting.createIssue(repoPath, remoteUrl, tokens, opts) as Promise<{ number: number; url: string }>,
  updatePR: (
    repoPath: string,
    remoteUrl: string,
    tokens: { github?: string },
    number: number,
    patch: { base?: string; title?: string; stackSection?: string }
  ) => window.api.hosting.updatePR(repoPath, remoteUrl, tokens, number, patch) as Promise<void>,
  mergedPrHeads: (repoPath: string, remoteUrl: string, tokens: { github?: string }, branches: string[]) =>
    window.api.hosting.mergedPrHeads(repoPath, remoteUrl, tokens, branches) as Promise<string[]>,
  /** Register chained PRs as a native GitHub stack; null when unavailable. */
  ensureStack: (repoPath: string, remoteUrl: string, tokens: { github?: string }, numbers: number[]) =>
    window.api.hosting.ensureStack(repoPath, remoteUrl, tokens, numbers) as Promise<GithubStackInfo | null>,
  listMilestones: (repoPath: string, remoteUrl: string, tokens: { github?: string }) =>
    window.api.hosting.listMilestones(repoPath, remoteUrl, tokens) as Promise<{
      provider: HostingProvider
      milestones: MilestoneInfo[]
    }>,
  milestoneIssues: (repoPath: string, remoteUrl: string, tokens: { github?: string }, number: number) =>
    window.api.hosting.milestoneIssues(repoPath, remoteUrl, tokens, number) as Promise<IssueInfo[]>
}

// OS keychain consent. Nothing in the app touches safeStorage until the user
// has answered the explainer this drives.
export const keychainApi = {
  onAsk: (cb: (payload: { reason: KeychainReason; adopted: boolean }) => void) =>
    window.api.keychain.onAsk((p) => cb({ reason: p.reason as KeychainReason, adopted: p.adopted })),
  answer: (granted: boolean) => window.api.keychain.answer(granted),
  status: () =>
    window.api.keychain.status() as Promise<{
      consent: KeychainConsent
      explained: boolean
      available: boolean | null
      /** Linux's basic_text fallback: "encrypted" with a fixed, public password. */
      weakBackend: boolean
      /** Some token is held in memory only and will not survive a quit. */
      sessionOnly: boolean
    }>,
  set: (granted: boolean) => window.api.keychain.set(granted),
  /** Fires once the stored tokens have been decrypted this session — by Settings, a push, anything. */
  onUnlocked: (cb: () => void) => window.api.keychain.onUnlocked(cb)
}

// Installs/checks the `githuttbr` shell command, the equivalent of VS Code's
// "Shell Command: Install 'code' in PATH", plus the two channels the CLI uses
// once it is installed: a request to open something, and a file git is waiting
// on (`githuttbr --wait`).
export const cliApi = {
  isInstalled: () => window.api.cli.isInstalled(),
  install: () => window.api.cli.install(),
  uninstall: () => window.api.cli.uninstall(),
  /** Installed, refused (and why), or a stale AppImage link left in PATH. */
  status: () => window.api.cli.status(),
  /** Delete `githuttbr` links that point into an AppImage's /tmp mount. */
  removeStale: () => window.api.cli.removeStale(),
  onOpenPath: (cb: (payload: CliOpenPayload) => void) => window.api.cli.onOpenPath(cb),
  onEdit: (cb: (req: { file: string; sentinel: string; content: string }) => void) =>
    window.api.cli.onEdit(cb),
  /** Hand the edited text back to git. `null` cancels, which git reads as
   *  "abort". Exactly one call per request — git is blocked until it lands. */
  finishEdit: (sentinel: string, content: string | null) => window.api.cli.finishEdit(sentinel, content)
}

// The native application menu. The renderer owns the menu's content — labels
// come from the dictionaries — and pushes a fresh spec whenever the language,
// the open repository or the tab list changes.
export const menuApi = {
  set: (spec: MenuSpec) => window.api.menu.set(spec),
  onCommand: (cb: (id: string) => void) => window.api.menu.onCommand(cb)
}

// Translated labels for the native right-click menu on text fields.
export const editMenuApi = {
  setLabels: (labels: EditMenuLabels) => window.api.editMenu.setLabels(labels)
}

export const launchApi = {
  resolveInputs: (dir: string, inputs: LaunchInput[]): Promise<LaunchInputResolution> =>
    window.api.launch.resolveInputs(dir, inputs)
}

export const windowApi = {
  reportUiCrash: (message: string) => window.api.window.reportUiCrash(message)
}
