// ─── Shared domain types (used by main, preload and renderer) ───────────────

import type { EditorSetting } from './editors'

export interface CommitAuthor {
  name: string
  email: string
}

/**
 * Verification state of a commit's signature, normalised from git's `%G?`:
 * good = valid; unverified = signed but key/validity unknown; bad = invalid or
 * revoked; expired = signature/key expired; none = unsigned.
 */
export type CommitSignature = 'good' | 'unverified' | 'bad' | 'expired' | 'none'

export interface GraphCommit {
  hash: string
  parents: string[]
  author: string
  email: string
  date: number // unix seconds
  refs: string[]
  subject: string
  coAuthors?: CommitAuthor[]
  signature?: CommitSignature // omitted when unsigned
  signer?: string // signing identity (%GS), when known
}

/** A branch that contains a given commit, grouped like the graph's ref
 *  badges: a local branch and its remote-tracking counterpart (e.g. `main` +
 *  `origin/main`) collapse into one entry instead of two separate rows. */
export interface CommitBranchInfo {
  name: string
  isLocal: boolean
  remotes: string[]
}

/** One working-tree match from a `git grep` content search. */
export interface CodeSearchHit {
  file: string
  line: number
  text: string
}

/** One commit from a history pickaxe search (`git log -S` / `-G`). */
export interface HistorySearchHit {
  hash: string
  author: string
  date: number // unix seconds
  subject: string
}

/** One GitHub notification thread (token-level, across all repos). */
export interface GitHubNotification {
  id: string // thread id (used to mark read)
  reason: string // e.g. review_requested, mention, assign, ci_activity
  title: string
  type: string // PullRequest | Issue | Release | Commit | Discussion | …
  repoFullName: string // owner/repo
  repoUrl: string // repository html_url
  number: number | null // PR / issue number when derivable
  unread: boolean
  updatedAt: number // unix seconds
  url: string // best-effort web URL to open
}

/** One branch within a stack (chain of dependent branches). */
export interface StackBranch {
  name: string
  parent: string | null // tracked parent branch, null for the trunk base
  isCurrent: boolean
  ahead: number // own commits not in parent
  needsRestack: boolean // parent tip moved — branch must be rebased onto it
}

/** A stack: ordered bottom (closest to trunk) → top (leaf). */
export interface StackInfo {
  trunk: string // base branch the stack sits on ('' if unknown)
  branches: StackBranch[]
}

/**
 * What `checkoutRemote` found when a local branch of the same name already
 * exists. `diverged` means both sides have unique commits; `aheadOnly` means
 * the local branch has commits the remote lacks and nothing was checked out —
 * the renderer asks the user which side they meant.
 */
export interface CheckoutRemoteResult {
  diverged: boolean
  aheadOnly: boolean
  ahead: number
  behind: number
  /** The tip of the local branch this call created, absent when it already existed.
   *  Undo deletes the branch only while it still points there. */
  createdAt?: string
}

/** Which of git's reset modes to use when moving a branch onto another tip. */
export type ResetStrategy = 'reset-soft' | 'reset-mixed' | 'reset-hard'

/** How to reconcile a local branch with its remote tip. */
export type DivergedStrategy = 'rebase' | 'merge' | ResetStrategy

/** Per-repo commit-signing configuration. */
export interface SigningConfig {
  sign: boolean // commit.gpgsign
  format: string // gpg.format: openpgp | ssh | x509
  key: string // user.signingkey ('' if unset)
}

/** State of one git hook file in the repo's hooks directory. */
export interface HookInfo {
  name: string // e.g. 'pre-commit'
  exists: boolean // a real (non-.sample) hook file is present
  executable: boolean // exec bit set — git only runs executable hooks
  sample: boolean // only the shipped `<name>.sample` template exists
  size: number // bytes of the real hook (0 when absent)
}

/** Snapshot of a repo's hooks directory + framework detection. */
export interface HooksInfo {
  hooksDir: string // resolved hooks directory (honours core.hooksPath)
  customHooksPath: boolean // core.hooksPath is set (custom/framework-managed)
  preCommitFramework: boolean // a .pre-commit-config.yaml(.yml) is present
  hooks: HookInfo[]
}

/** One file tracked by Git LFS (from `git lfs ls-files`). */
export interface LfsFile {
  path: string
  oid: string // short object id
  downloaded: boolean // true = real content present, false = pointer only
}

/** Cone-mode sparse-checkout state for a repo. */
export interface SparseCheckoutInfo {
  enabled: boolean // core.sparseCheckout is on
  cone: boolean // cone mode (directory-based)
  dirs: string[] // currently-included top-level directories
  topLevelDirs: string[] // all top-level directories in HEAD (toggle candidates)
}

/** Git LFS state for a repo. */
export interface LfsInfo {
  installed: boolean // the git-lfs binary is available
  enabled: boolean // the repo tracks anything via LFS
  patterns: string[] // tracked glob patterns from .gitattributes
  files: LfsFile[]
}

export interface BranchInfo {
  name: string
  sha: string
  upstream: string | null
  ahead: number
  behind: number
  isCurrent: boolean
  mergedIntoCurrent: boolean
}

export interface RemoteBranchInfo {
  remote: string
  name: string
  fullName: string
  sha: string
  mergedIntoCurrent: boolean
}

export interface TagInfo {
  name: string
  sha: string
}

export interface BranchesPayload {
  current: string
  locals: BranchInfo[]
  remotes: RemoteBranchInfo[]
  tags: TagInfo[]
}

/**
 * How a ref would land if it were merged into the base right now.
 * `merged` means the merge would be a no-op (the ref is already contained).
 */
export type MergeRiskKind = 'merged' | 'clean' | 'conflict' | 'error'

/** One branch's forecast in the Conflict Radar. */
export interface MergePreviewEntry {
  ref: string
  status: MergeRiskKind
  /** Paths that would conflict (only for `conflict`). */
  files: string[]
  /** Error text from git, when `status` is `error`. */
  message?: string
}

export interface MergePreviewResult {
  base: string
  baseSha: string
  entries: MergePreviewEntry[]
  /** Unix ms of the scan, so the UI can show "scanned 2m ago". */
  scannedAt: number
}

/** Validation + metadata for editing a historical commit in place. */
export interface CommitEditInfo {
  /** Merge-free path to HEAD. Kept for UI copy — editing no longer requires it. */
  linear: boolean
  /** The commit is an ancestor of HEAD — the only hard requirement for editing. */
  ancestor: boolean
  /** Merge commits in the range, each replayed with its recorded resolutions. */
  merges: number
  /** Commits between it and HEAD that a rewrite would replay. */
  descendants: number
  /** Reachable from a remote ref — rewriting means a force push later. */
  pushed: boolean
  /** The remote-tracking branches that already hold it (`origin/main`), for the warning. */
  remoteBranches: string[]
  /** The commits a rewrite replays — descendants of it up to HEAD, newest first, capped. */
  above: CommitEditAbove[]
  /** How many commits a rewrite replays, uncapped; `above` may list fewer. */
  aboveTotal: number
  message: string
  authorName: string
  authorDate: string // ISO
}

/** One commit above the edited one, before any preview has run. */
export interface CommitEditAbove {
  sha: string
  subject: string
  merge: boolean
}

/** A historical blob, loaded for in-place editing. */
export interface BlobAtCommit {
  /** null when binary or too large to edit. */
  content: string | null
  binary: boolean
  size: number
}

/** One replayed descendant in a commit-edit cascade. */
export interface CommitEditStep {
  sha: string
  subject: string
  /** blocked = never attempted because an earlier step conflicted. */
  status: 'clean' | 'conflict' | 'blocked'
  /** Conflicting paths (conflict only). */
  files: string[]
  /** A merge commit, replayed with its recorded conflict resolutions. */
  merge?: boolean
}

/** Dry-run result of rewriting a commit: the cascade forecast. */
export interface CommitEditPreview {
  /** The would-be new HEAD; null when the cascade conflicts. */
  newTip: string | null
  steps: CommitEditStep[]
}

export interface CommitEditResult {
  oldHead: string
  newTip: string
  rewritten: number
}

/** Batched git facts for the single-commit context menu (amend / undo / reset / GitHub). */
export interface CommitMenuProbe {
  isHead: boolean
  isOnLocalBranch: boolean
  /** Reachable from at least one remote-tracking branch — not tags. */
  isPublished: boolean
  isAncestorOfHead: boolean
  /** Local (unpushed) ancestor, or the first published/base ancestor of HEAD. */
  isWithinResetBoundary: boolean
  isRoot: boolean
  parentSha: string | null
  operationInProgress: boolean
  message: string
  headSha: string
  branch: string
}

/** Result of undoing HEAD — enough for the composer prefill and an undo entry. */
export interface UndoCommitResult {
  previousSha: string
  parentSha: string | null
  wasRoot: boolean
  message: string
  branch: string
}

/** One remote branch's activity as seen by the teammate radar. */
export interface TeammateRadarEntry {
  ref: string // short remote ref, e.g. origin/feature-x
  sha: string
  author: string // last committer on the branch
  time: number // unix seconds of that commit
  ahead: number // commits this branch has that HEAD does not
  filesTouched: number // files those commits change
  /** Of those files, the ones currently dirty in the local working tree. */
  overlap: string[]
  /** Predicted result of merging this branch into HEAD (merge-tree, in-memory). */
  risk: MergeRiskKind
  conflictFiles: string[]
}

/** Remote awareness computed from the last fetch — no server, no network. */
export interface TeammateRadarResult {
  entries: TeammateRadarEntry[]
  /** How many files were dirty locally when the scan ran. */
  dirtyCount: number
  scannedAt: number // unix ms
}

/** How one commit fared between two versions of a branch (`git range-diff`). */
export type RangeDiffKind = 'unchanged' | 'modified' | 'removed' | 'added'

/** One commit pair from a range-diff. */
export interface RangeDiffEntry {
  kind: RangeDiffKind
  /** Position in the old range, null when the commit is new. */
  oldIndex: number | null
  oldSha: string | null
  /** Position in the new range, null when the commit was dropped. */
  newIndex: number | null
  newSha: string | null
  subject: string
  /** Interdiff — how the commit itself was rewritten. Only for `modified`. */
  body: string
}

/** One staged hunk in an absorb plan. */
export interface AbsorbHunk {
  file: string
  /** The `@@ …` header, shown so the user can tell two hunks apart. */
  header: string
  added: number
  removed: number
}

/** A commit that some of the staged hunks belong to. */
export interface AbsorbTarget {
  sha: string
  subject: string
  hunks: AbsorbHunk[]
}

export interface AbsorbPlan {
  /** The commit the fixups will be squashed onto (parent of the oldest candidate). */
  base: string
  /** How the candidate range was decided, for the UI to explain itself. */
  rangeLabel: string
  targets: AbsorbTarget[]
  /** Hunks blame could not pin on an absorbable commit — left staged as they are. */
  unmatched: AbsorbHunk[]
  /** Why there is nothing to do, when there is nothing to do. */
  reason?: 'no-staged' | 'no-commits' | 'in-progress'
}

/** One repository's local health, as shown in Mission Control. */
/** A theme colour a Mission Control release note can take — tokens, so a theme repaints them. */
export type ReleaseToneName = 'muted' | 'accent' | 'green' | 'yellow' | 'red' | 'purple'
export const RELEASE_TONES: ReleaseToneName[] = ['muted', 'accent', 'green', 'yellow', 'red', 'purple']
/** A theme tone, or a colour of the user's own as `#rrggbb` — that one stays as picked in every theme. */
export type ReleaseTone = ReleaseToneName | `#${string}`

/** Whether `tone` is a custom `#rrggbb` colour rather than a theme tone. */
export function isCustomReleaseTone(tone: string): tone is `#${string}` {
  return /^#[0-9a-f]{6}$/i.test(tone)
}

/** Ranges by commit count: up to `limits[i]` takes `tones[i]`; past the last
 *  limit, the last tone. `tones` is one longer than `limits`. */
export interface ReleaseNoteTiers {
  limits: number[]
  tones: ReleaseTone[]
}

/** How many ranges Settings offers. */
export const RELEASE_TIER_COUNT = 4

/** Quiet while a release is recent, yellow past 5 commits, red past 20 — the
 *  range past 50 starts red too, for whoever wants it louder. */
export const DEFAULT_RELEASE_TIERS: ReleaseNoteTiers = { limits: [5, 20, 50], tones: ['muted', 'yellow', 'red', 'red'] }

export interface RepoPulse {
  path: string
  name: string
  /** Empty when HEAD is detached. */
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  staged: number
  unstaged: number
  untracked: number
  conflicted: number
  stashes: number
  /** Unix seconds of the last commit, 0 for an empty repo. */
  lastCommitAt: number
  /** HEAD's subject and author — what the repo was last doing. Null for an empty repo. */
  lastCommit: { subject: string; author: string } | null
  /** Epoch ms of the last fetch (FETCH_HEAD's mtime), null when it never fetched.
   *  The behind count is only as fresh as this, since reading never fetches. */
  lastFetchAt: number | null
  /** A merge/rebase/cherry-pick left in progress, if any. */
  operation: ConflictOpKind | null
  /** Commits per day over the last fortnight, oldest first (row sparkline). */
  activity: number[]
  /** HEAD's commit, null in an empty repo — the key a CI status is asked by. */
  headSha?: string | null
  /** The remote hosting data comes from (origin, else the first), null without one. */
  remoteUrl?: string | null
  /** The newest tag reachable from HEAD and how many commits came after it; null with no tag. */
  release?: { tag: string; since: number } | null
  /** Set when the repo could not be read at all (moved, deleted, not a repo). */
  error: string | null
}

/** What an expanded Mission Control row shows: the work in flight. */
export interface RepoDetail {
  files: { path: string; status: FileChangeKind }[]
  commits: { hash: string; subject: string }[]
}

/** One commit in the timelapse stream: who, when, and what it touched. */
export interface TimelapseCommit {
  hash: string
  author: string
  date: number // unix seconds
  subject: string
  files: { path: string; status: FileChangeKind }[]
}

/** A remote-tracking ref that was rewritten under us (history was force-pushed). */
export interface ForcedRefUpdate {
  /** Short form, e.g. `origin/feature`. */
  ref: string
  oldSha: string
  newSha: string
}

/**
 * Why a plain `git pull` had nothing to merge into, and which repair fits.
 * `remoteRefExists` splits the two cases apart: a branch already on the remote
 * only needs the tracking config, one that is not there yet needs a push.
 */
export interface UpstreamSuggestion {
  /** The checked-out branch that tracks nothing. */
  branch: string
  /** The remote it would track — `origin` when present, else the first one. */
  remote: string
  remoteRefExists: boolean
}

/**
 * A `*.lock` file still sitting inside the git directory. Git takes one for the
 * duration of a write and removes it on the way out; one that outlives the
 * process that made it (a crash, a killed terminal, a network share that lost
 * the file handle) blocks every later write with "File exists" until someone
 * deletes it by hand.
 */
export interface GitLockFile {
  /** Path relative to the git directory: `index.lock`, `refs/remotes/origin/x.lock`. */
  path: string
  /** Seconds since the file was last touched — a young lock is a live git process. */
  ageSeconds: number
  /** What the lock guards, for copy that does not require reading git internals. */
  kind: 'index' | 'ref' | 'config' | 'other'
}

/**
 * A native GitHub stack, once the chain has been registered as one. Chaining
 * the bases is what every host understands; this is the extra GitHub gives on
 * top — the stack map in its UI, the server-side cascading rebase, and one
 * merge that lands the levels below.
 */
export interface GithubStackInfo {
  /** The stack's own number on GitHub. */
  number: number
  url?: string
  /** How many levels this submit put into it. */
  added: number
}

/** One past position of a ref, read from its reflog. */
export interface RefTip {
  sha: string
  /** Reflog selector, e.g. `origin/feature@{2}`. */
  selector: string
  /** What moved it: 'fetch: forced-update', 'rebase (finish)', 'commit'… */
  reason: string
  date: number // unix seconds
  subject: string
}

/** Whether the user has let GitHuttBr use the OS keychain (safeStorage). */
export type KeychainConsent = 'granted' | 'declined' | 'unset'

/** What GitHuttBr is about to encrypt, so the explainer can say why it asks. */
export type KeychainReason = 'tokens' | 'vault' | 'settings'

/** What a declaration is, for the semantic-diff labels. */
export type SemanticSymbolKind =
  | 'function'
  | 'method'
  | 'class'
  | 'interface'
  | 'struct'
  | 'enum'
  | 'type'
  | 'module'
  | 'property'

/** One structural difference between two versions of a file. */
export interface SemanticChange {
  kind: 'added' | 'removed' | 'renamed' | 'signature' | 'moved' | 'changed'
  /** Qualified name in the new file (`Class.method`). */
  symbol: string
  /** Previous qualified name, for renames. */
  oldName?: string
  symbolKind: SemanticSymbolKind
  /** 1-based line in the new file (the old file, for removals). */
  line?: number
  /** Rename: how many times the identifier appears. Move: line delta. */
  detail?: string
  oldSignature?: string
  newSignature?: string
  /** A rename or signature change that also rewrote the body. */
  bodyChanged?: boolean
}

export interface SemanticDiff {
  /** Grammar used, or null when the file's language has none (UI stays on lines). */
  language: string | null
  changes: SemanticChange[]
  /** File too big to parse twice — no changes were computed. */
  truncated?: boolean
}

/** Which version of a file to read: a git ref, the index, or the working tree. */
export type BlobSpec = { kind: 'ref'; ref: string } | { kind: 'index' } | { kind: 'worktree' } | { kind: 'empty' }

export type FileChangeKind = 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | '?'

export interface FileEntry {
  path: string
  status: FileChangeKind
  untracked?: boolean
}

export interface RepoStatus {
  current: string
  tracking: string | null
  ahead: number
  behind: number
  staged: FileEntry[]
  unstaged: FileEntry[]
  conflicted: FileEntry[]
}

/** Working-tree status of a tree node, derived from `git status --ignored`.
 *  Directories report the most "interesting" status of their descendants. */
export type TreeStatusKind = 'modified' | 'added' | 'untracked' | 'ignored' | 'deleted' | 'renamed' | 'conflicted'

/** What a drag & drop in the project tree does when the destination already has
 *  an entry with the same name: fail, trash the old one, or keep both. */
export type FsDropMode = 'error' | 'replace' | 'keepBoth'

/** One immediate child of a directory in the project tree. */
export interface TreeEntry {
  /** Base name (no path). */
  name: string
  /** Repo-relative POSIX path. */
  path: string
  /** True for directories. */
  dir: boolean
}

export type ConflictOpKind = 'merge' | 'cherry-pick' | 'rebase' | 'revert'
export type ConflictSide = 'ours' | 'theirs' | 'delete'

export interface ConflictVersions {
  content: string
  ours: string | null
  theirs: string | null
  base: string | null
}

/** Identity of the commit behind one side of an in-progress conflict. */
export interface ConflictRefInfo {
  /** Short sha the side points at. */
  sha: string
  /** Branch the commit belongs to, '' when it resolves to no name. */
  branch: string
  subject: string
  author: string
  /** ISO timestamp. */
  date: string
}

/** Who is being merged into whom, for the "merging X into Y" header and the
 *  per-side commit labels in the conflict editor. */
export interface ConflictContext {
  kind: ConflictOpKind
  /** Incoming side — the branch/commit being merged, rebased or picked. */
  source: string
  /** Receiving side — the branch the operation lands on. */
  target: string
  /** Stage 2 (`--ours`) commit: HEAD, i.e. the branch you are on. */
  ours: ConflictRefInfo | null
  /** Stage 3 (`--theirs`) commit: MERGE_HEAD / REBASE_HEAD / CHERRY_PICK_HEAD. */
  theirs: ConflictRefInfo | null
  /** Short sha of the version both sides started from: the merge base, or the
   *  picked/replayed commit's parent. '' when there is none to name. */
  baseSha?: string
}

/**
 * What kind of conflict a file is in, read from git's two-letter unmerged
 * status (`UU`, `AA`, `DU`, `UD`, `AU`, `UA`, `DD`).
 */
export type ConflictFileKind =
  | 'both-modified'
  | 'both-added'
  | 'deleted-by-us'
  | 'deleted-by-them'
  | 'added-by-us'
  | 'added-by-them'
  | 'renamed-both'

/** One unmerged path, as the conflict workspace's file strip shows it. */
export interface ConflictFileInfo {
  path: string
  /** git's `XY` code, verbatim. */
  code: string
  kind: ConflictFileKind
  /** Conflict blocks (`<<<<<<<` markers) in the working-tree file. */
  conflicts: number
  /** On a `renamed-both` original: the name each side gave it. */
  renamedTo?: { ours: string; theirs: string }
  /** On one half of a rename/rename pair: the original it belongs to. The strip
   *  folds it into that original's card instead of listing it twice. */
  renameOf?: string
}

export interface ConflictOverview {
  files: ConflictFileInfo[]
  /** Paths git listed under `# Conflicts:` in MERGE_MSG — every file this step
   *  stopped on, resolved or not. Empty for a rebase, which does not write it. */
  listed: string[]
}

/**
 * The unmerged state of some paths, captured before resolving them so the
 * resolution can be undone: the index stages plus the working-tree content.
 */
export interface ConflictSnapshot {
  /** `git ls-files -u -s -z` output for the paths. */
  stages: string
  /** `blob` is the sha of the file's bytes, written to the object store as a
   *  loose object; null when the file was not on disk. */
  files: { path: string; blob: string | null }[]
}

export interface StashInfo {
  index: number
  sha: string
  parentSha: string
  untrackedSha: string | null
  message: string
  branch: string | null
  date: number
}

/** What a remote URL carries in its userinfo (shared/remoteUrlCredentials.ts). */
export type UrlCredentialKind = 'password' | 'username'

export interface RemoteInfo {
  name: string
  /** Any password in the URL is removed before it leaves main; a user name stays. */
  url: string
  /** What the remote's fetch or push URLs carry in their userinfo, worst first.
   *  Absent when none carries anything. */
  urlCredentials?: UrlCredentialKind
  /** A password is there but its URL is ambiguous about the host, so it is not
   *  offered for automatic removal (shared/remoteUrlCredentials.ts). */
  urlCredentialsAmbiguous?: true
}

/** One of a remote's configured URLs that carries a user name or a password. */
export interface RemoteUrlCredentialUrl {
  /** `fetch` for `remote.<name>.url`, `push` for `remote.<name>.pushurl`. */
  role: 'fetch' | 'push'
  kind: UrlCredentialKind
  /** The URL as the fix writes it — the userinfo removed (an ssh user name kept).
   *  For an ambiguous one, the URL redacted greedily: it is not rewritten. */
  url: string
  /** Readers disagree on where its host starts: never rewritten automatically. */
  ambiguous?: true
}

/**
 * A remote whose configured URLs carry credentials. Never the user name or the
 * password themselves: only which URLs, what kind, and the clean form.
 */
export interface RemoteUrlCredentials {
  remote: string
  /** The worst of `urls`: a password outranks a user name. */
  kind: UrlCredentialKind
  /** A password is there and every URL holding one can be cleaned safely. */
  removable: boolean
  urls: RemoteUrlCredentialUrl[]
}

export interface RepoSummary {
  path: string
  name: string
  current: string
}

export interface PullRequest {
  id: number
  title: string
  author: string
  sourceBranch: string
  targetBranch: string
  url: string
  isDraft: boolean
  /** GitHub's own stack number, when this PR belongs to a native stack. */
  stackNumber?: number
  /** Where it stands. Absent means open — the state a plain list implies. */
  state?: 'open' | 'closed' | 'merged'
  /** The head commit, so its checks can be looked up. */
  headSha?: string
  /** Rolled-up state of the head commit's checks, when they were read. */
  ci?: CiState
  /** The head's checks counted per outcome, for the row's tooltip — the
   *  renderer words them ("2 passed · 1 failing") in the user's language. */
  ciCounts?: CiCounts
  /** owner/repo the head branch lives in (GitHub), to tell a fork's PRs apart. */
  headRepo?: string
  /** Logins asked to review and not answered yet, as the list reports them. */
  requestedReviewers?: string[]
  /** You are one of those reviewers — the sidebar marks the row. */
  awaitingYou?: boolean
  /** ISO time of the last activity, when the host's list says (Azure DevOps
   *  lists none — there it is when the PR was opened). */
  updatedAt?: string
  /** The description, when the list carries it — searched by the PR list page. */
  body?: string
  /** The author's picture, when the host's list names one (https only is drawn). */
  authorAvatar?: string
  /** Lines added and removed and files touched, when the host's list says
   *  (GitHub through one GraphQL read, Forgejo in its list). Absent: unknown. */
  additions?: number
  deletions?: number
  changedFiles?: number
  /** Conversation comments, when the host's list counts them. */
  commentCount?: number
  /** When the latest comments were written and by whom — enough to count the
   *  ones newer than your last visit. Absent where the list has no times. */
  recentComments?: PrListComment[]
  /** Each reviewer's standing verdict, when the host's list says. Present and
   *  empty means "nobody has given one"; absent means the host did not say. */
  reviews?: PrListReview[]
  /** The host considers it approved and ready to go in (GitHub's review
   *  decision, GitLab's merge status). */
  readyToMerge?: boolean
}

/** One comment's time and author, as the PR list counts the new ones. */
export interface PrListComment {
  at: string
  author: string
}

/** A reviewer's verdict on a pull request, as its list row shows it. */
export interface PrListReview {
  login: string
  verdict: 'approved' | 'changes'
}

/**
 * The merged and closed pull requests of a remote, newest activity first — the
 * PR list page's second and third tabs. One call, a bounded window: `truncated`
 * says the host had more than was read.
 */
export interface FinishedPullRequests {
  provider: HostingProvider
  prs: PullRequest[]
  truncated: boolean
}

export type HostingProvider = 'github' | 'azure' | 'gitlab' | 'bitbucket' | 'forgejo' | null

/** Whether a hosting action on a remote has a credential: 'unknown' while the token store is still locked. */
export type HostingAccess = 'yes' | 'no' | 'unknown'

/** The ref-naming convention a forge uses to publish pull request heads. */
export type PrRefFlavor = 'github' | 'gitlab' | 'bitbucket' | 'azure'

/** One ref a pull request's head might live under on a given remote. */
export interface PrRefCandidate {
  flavor: PrRefFlavor
  ref: string
}

/** A pull request ref that actually exists on the remote, found by `ls-remote`. */
export interface PrRefProbe extends PrRefCandidate {
  sha: string
}

/**
 * How a previewed ref is applied locally. Neither mode writes a commit:
 * `checkout` parks the ref on a local branch, `merge` leaves the merged tree
 * staged but uncommitted so it can be tested and then thrown away.
 */
export type PrPreviewMode = 'checkout' | 'merge'

export interface PrPreviewResult {
  ref: string
  sha: string
  mode: PrPreviewMode
  /** Set for `checkout` — the local branch the ref was fetched into. */
  localBranch?: string
  /** Paths left conflicted by a `merge` preview; empty when it applied cleanly. */
  conflicts: string[]
}

/**
 * Where a comment lives on its host, so it can be edited or deleted. Absent on a
 * comment the host offers no API to change (a Forgejo review comment).
 */
export interface PrCommentHandle {
  /** The host's own comment id (GitLab: the note id). */
  id: number
  /**
   * Which endpoint the comment is reached through, where the host has two:
   * GitHub and Forgejo keep conversation comments with the issue, and review
   * comments with the pull request. The hosts with one endpoint ignore it.
   */
  kind: PrCommentKind
  /** Azure DevOps: the thread the comment belongs to. */
  threadId?: number
  /** Bitbucket Data Center: the comment's version, which an edit or a delete must name. */
  version?: number
}

export type PrCommentKind = 'conversation' | 'review'

/** A comment on a pull request's conversation. */
export interface PrComment {
  author: string
  body: string
  /**
   * The host's own rendering of `body` (GitHub's `body_html`: mentions and
   * references linked, images proxied, private attachments signed). Untrusted —
   * the page sanitizes it like any comment. `body` stays for editing.
   */
  bodyHtml?: string
  createdAt: string
  handle?: PrCommentHandle
  /** The host says the text was changed after it was posted. */
  edited?: boolean
  /** The author's account id, where `author` is a display name (Azure DevOps). */
  authorId?: string
  /** The author's unique account name (Azure DevOps `uniqueName`): "yours" also matches on it. */
  authorUniqueName?: string
  /** Others answered it, in the host's own thread (Data Center, Azure DevOps, GitLab). */
  hasReplies?: boolean
}

/** A submitted review on a pull request. */
export interface PrReview {
  author: string
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  /** ISO date the review was submitted. Absent where the host does not say (Azure DevOps votes,
   *  Bitbucket Data Center); without it the review shows in the sidebar, not on the timeline. */
  submittedAt?: string
  /** The review's own text (the summary written with "Request changes"), when the host gives one. */
  body?: string
}

/** One comment within an inline review thread. */
export interface PrReviewComment {
  id: number
  author: string
  body: string
  /**
   * The host's own rendering of `body` (GitHub's `body_html`: mentions and
   * references linked, images proxied, private attachments signed). Untrusted —
   * the page sanitizes it like any comment. `body` stays for editing.
   */
  bodyHtml?: string
  createdAt: string
  handle?: PrCommentHandle
  /** The host says the text was changed after it was posted. */
  edited?: boolean
  /** The author's account id, where `author` is a display name (Azure DevOps). */
  authorId?: string
  /** The author's unique account name (Azure DevOps `uniqueName`): "yours" also matches on it. */
  authorUniqueName?: string
}

/** An inline review thread anchored to a file/line in the PR diff. */
export interface PrReviewThread {
  path: string
  line: number | null
  diffHunk: string // the surrounding diff context (GitHub only; empty on GitLab)
  /** Reply target: GitHub root comment id, or GitLab discussion id. */
  rootId: number | string
  comments: PrReviewComment[]
  /**
   * Which side of the diff `line` counts on: `old` for a deleted line, `new` for
   * an added or unchanged one. Absent when the host does not say, or when the
   * thread no longer sits on the current diff (an outdated GitHub comment) —
   * the Files tab then lists it only in the conversation, never on a guessed line.
   */
  side?: PrLineSide
  /** The host marks the thread resolved (GitHub, GitLab). Absent where the host does not say
   *  or the read failed — unknown, which the page shows as neither open nor resolved. */
  resolved?: boolean
}

/** Which version of a file a diff line belongs to: before the change, or after. */
export type PrLineSide = 'old' | 'new'

/**
 * One line of a PR file's diff, as a new line comment is anchored to it. Both
 * numbers are kept because the hosts disagree on which they want — GitLab
 * needs both for an unchanged line, the others one, picked by side.
 */
export interface PrLineAnchor {
  path: string
  /** The path before a rename; absent when the file kept its name. */
  oldPath?: string
  kind: 'add' | 'del' | 'ctx'
  /** The line in the old version — null for an added line. */
  oldLine: number | null
  /** The line in the new version — null for a deleted line. */
  newLine: number | null
}

/** One CI check-run on a PR's head commit. */
export interface PrCheck {
  name: string
  /** queued | in_progress | completed */
  status: string
  /** success | failure | neutral | cancelled | skipped | timed_out | action_required | null (while running) */
  conclusion: string | null
  url: string // details/logs URL
  /** The app can read this check's log itself (a Forgejo Actions job on the PR's own server). */
  hasLog?: boolean
  /** Epoch milliseconds, when the host says. Forgejo's are the status's own times, queue included. */
  startedAt?: number
  finishedAt?: number
  /** The commit the check ran on. */
  sha?: string
  /** The CI run it belongs to, as the CI runs page knows it — set only where that
   *  host lets the app re-run a run's failed jobs (GitHub Actions, GitLab, Azure). */
  runId?: string
}

/** A changed file in a pull request (file-by-file review checklist). */
export interface PrFile {
  filename: string
  /** added | modified | removed | renamed */
  status: string
  additions: number
  deletions: number
  /** The file's unified diff hunks. Absent when there is none to show —
   *  `noPatchReason` then says why. */
  patch?: string
  /** The path before a rename. */
  previousFilename?: string
  /** Why `patch` is absent, set by the main process. Absent on a file with a patch. */
  noPatchReason?: PrNoPatchReason
  /** What went wrong, when `noPatchReason` is `failed` — the error's own words, no token. */
  noPatchError?: string
  /** Where the file's diff can be read later — on demand, or again after a failure. */
  diffSource?: PrFileDiffSource
}

/**
 * Why a pull request file has no diff on screen:
 * - `binary` — its bytes are not text (checked on the bytes, not the host's flag);
 * - `tooLarge` — the change is too big to diff or draw here;
 * - `notLoaded` — not read yet; it is read when the file is opened;
 * - `failed` — reading it failed (`noPatchError` says how), worth trying again;
 * - `hostOmitted` — the host's API left the diff out and this clone has neither commit;
 * - `noChanges` — a rename or a mode change: nothing in the content changed;
 * - `encodingChanged` — the same text, saved in another encoding (a BOM added or dropped).
 */
export type PrNoPatchReason = 'binary' | 'tooLarge' | 'notLoaded' | 'failed' | 'hostOmitted' | 'noChanges' | 'encodingChanged'

/**
 * The two commits a pull request file's diff is between, and the pull request
 * they belong to — what `hosting:prFileDiff` needs to read one file again.
 * The diff starts at the merge base of `baseSha` and `headSha` (the merge base
 * itself, or the target branch's tip), or at `baseSha` itself when `straight`
 * — one update's own changes, head against previous head.
 */
export interface PrFileDiffSource {
  remoteUrl: string
  number: number
  baseSha: string
  headSha: string
  straight?: boolean
}

/** One file to read again, and where from. */
export interface PrFileDiffRequest {
  file: Pick<PrFile, 'filename' | 'status' | 'previousFilename'>
  source: PrFileDiffSource
}

/**
 * Which version of a pull request a diff was read at: the head commit (and
 * merge base, where the host names it), plus Azure DevOps's iteration. A line
 * comment carries it, so a push after the diff loaded is caught instead of the
 * comment landing on whatever line now has that number.
 */
export interface PrDiffRevision {
  headSha: string
  baseSha?: string
  /** Azure DevOps: the iteration the diff is the last of. */
  iteration?: number
}

/** A pull request's changed files and the revision they were read at — null
 *  when the host did not say, or the PR moved while they were being read. */
export interface PrFileList {
  files: PrFile[]
  revision: PrDiffRevision | null
  /** The two commits the files were diffed between, resolved — what the image preview reads too. */
  commits?: PrDiffCommits | null
  /** The host listed fewer files than the pull request has (its own cap was reached). */
  truncated?: boolean
}

/** When the Files tab may fetch the pull request's missing commits (main/prLocalFiles.ts). */
export type PrFilesFetchMode = 'none' | 'once' | 'refresh'

/** Sent while the Files tab fetches the pull request's commits, for its hint. */
export interface PrFilesFetching {
  repoPath: string
  remoteUrl: string
  number: number
  fetching: boolean
}

/**
 * The two commits a pull request's diff compares. `baseKind` says what
 * `baseSha` is: the merge base (what every host's own diff starts from), or
 * the target branch's tip when nothing could name the merge base — then a
 * change landed on the target since the branch was cut shows too, and the UI
 * says so. Null `baseSha` when the host would not say at all.
 */
export interface PrDiffCommits {
  headSha: string
  baseSha: string | null
  baseKind: 'mergeBase' | 'targetTip'
}

/** One commit of a pull request, as its host lists it. */
export interface PrCommit {
  sha: string
  shortSha: string
  /** The message's first line. */
  subject: string
  /** The rest of the message, trimmed; absent when there is none. */
  body?: string
  authorName: string
  /** The author's account on the host, when the host matched one. */
  authorLogin?: string
  /** An https picture of the author, when the host gives one without a sign-in. */
  authorAvatar?: string
  /** ISO date the commit was authored. */
  authoredAt: string
  /** Parent count — above one is a merge commit. Absent when the host does not say. */
  parents?: number
}

/** What one commit changed against its parent: the Commits tab's "+12 −3 · 2 files". */
export interface PrCommitStats {
  additions: number
  deletions: number
  files: number
}

/** A pull request's commits, oldest first. `truncated` when the host has more
 *  than it listed (GitHub stops at 250) or the app stopped paging. */
export interface PrCommitList {
  commits: PrCommit[]
  truncated: boolean
  /** Which end a truncated list kept — the host's first ones as it lists them:
   *  the oldest on an oldest-first host, the most recent on a newest-first one. */
  kept: 'oldest' | 'newest'
}

/**
 * What kind of push made an update: the one that opened the pull request, a
 * push that only added commits, or one that rewrote history (a force push or a
 * rebase) — earlier commits may be gone from the branch.
 */
export type PrUpdateKind = 'opened' | 'push' | 'rewrite'

/**
 * One update of a pull request — a push to its source branch, as Azure DevOps
 * calls an iteration and GitLab a diff version.
 */
export interface PrUpdate {
  /** The host's own id for it (iteration, version, activity), else its head sha.
   *  What "seen" remembers. */
  id: string
  /** 1 for the push that opened the PR, counting up, oldest first. */
  index: number
  kind: PrUpdateKind
  /** ISO date of the push; empty when the host does not say. */
  createdAt: string
  /** Who pushed, when the host says. */
  pusher?: string
  /** The source branch's head after this push, when known. */
  headSha?: string
  /** What "the changes in this update" are read against: the previous update's
   *  head (a force push's own "before" where the host names it), or the merge
   *  base for the first update. Absent when nobody can tell. */
  fromSha?: string
  /** Azure DevOps: the iteration number, for `$compareTo`. */
  iteration?: number
  /** The commits this push brought, oldest first. */
  added: PrCommit[]
  /** The commits it took off the branch, when the host reports them. */
  removed: PrCommit[]
  /** The host counted more commits than it listed. */
  commitsTruncated?: boolean
  /** Azure DevOps: the push changed the target branch (a retarget), not the source. */
  retarget?: boolean
}

/**
 * How a host's updates were told apart: `native` from the host's own record of
 * pushes, `approximate` reconstructed from commit and force-push dates (GitHub
 * keeps no record of a plain push), `single` when the host records none and
 * every commit sits in one update, `unsupported` when the host has no way.
 */
export type PrUpdateGrouping = 'native' | 'approximate' | 'single' | 'unsupported'

/** A pull request's updates, oldest first. `truncated` when a cap stopped the reading. */
export interface PrUpdateList {
  updates: PrUpdate[]
  truncated: boolean
  grouping: PrUpdateGrouping
  /** The host's record was read from its newest end and stopped before the
   *  opening: the numbers are not the host's, so the tab counts back from the latest. */
  startCut?: boolean
}

/** One update's changed files from the host. `fromMergeBase` when the host diffs
 *  from the two heads' merge base (GitHub, Bitbucket Data Center), not between them. */
export interface PrUpdateFiles {
  files: PrFile[]
  fromMergeBase: boolean
}

/** One end of an update's comparison: a commit, and Azure's iteration of it. */
export interface PrUpdateEnd {
  sha: string
  iteration?: number
}

/** Full detail for one pull request (conversation + review state). */
export interface PrDetail {
  number: number
  title: string
  body: string
  /**
   * The host's own rendering of `body` (GitHub's `body_html`: mentions and
   * references linked, images proxied, private attachments signed). Untrusted —
   * the page sanitizes it like any comment. `body` stays for editing.
   */
  bodyHtml?: string
  author: string
  source: string
  target: string
  draft: boolean
  state: 'open' | 'closed'
  merged: boolean
  mergeable: boolean | null
  /**
   * Why the host refuses the merge although nothing conflicts — Bitbucket Data
   * Center's merge-check vetoes, in the server's own words. Absent elsewhere.
   */
  mergeBlockers?: string[]
  /** The host refuses the merge without saying why (Data Center's `canMerge: false`
   *  with no veto and no conflict). Absent elsewhere. */
  mergeRefused?: boolean
  url: string
  comments: PrComment[]
  reviews: PrReview[]
  reviewThreads: PrReviewThread[]
  // What the PR page's sidebar shows. Optional: a host that does not report a
  // field simply leaves that row out.
  createdAt?: string
  updatedAt?: string
  closedAt?: string | null
  mergedAt?: string | null
  mergedBy?: string | null
  assignees?: PrPerson[]
  /** Asked to review and not yet answered. A team is `org/team`, flagged `team`. */
  requestedReviewers?: PrPerson[]
  labels?: PrLabel[]
  milestone?: string | null
  /** Lines added / removed across the PR (GitHub; GitLab does not report them). */
  additions?: number
  deletions?: number
  changedFiles?: number
  commits?: number
  /** `commits` is a floor: the host was asked for one page and it was full. */
  commitsCapped?: boolean
  /** owner/repo the head branch lives in, when it differs from the base (a fork). */
  sourceRepo?: string | null
  /** Avatar URL per login, for everyone the host named in this PR. */
  avatars?: Record<string, string>
  /** Work items linked to the PR (Azure Boards). */
  workItems?: PrWorkItem[]
  /**
   * Who this page's calls sign in as, named the way the host names comment
   * authors: what "your comment" is matched on. Null when the token cannot say.
   */
  viewer?: string | null
  /** The viewer's account id, where the host has one worth matching on (Azure DevOps, bitbucket.org). */
  viewerId?: string | null
  /** The viewer's unique account name (Azure DevOps), matched against `authorUniqueName`. */
  viewerUniqueName?: string | null
  /** Authors are display names two people can share: "yours" is matched on `viewerId` only. */
  viewerById?: boolean
}

/** A work item a pull request is linked to. */
export interface PrWorkItem {
  id: number
  title: string
  /** Bug, User Story, Task… */
  type?: string
  /** New, Active, Resolved… */
  state?: string
  url: string
}

/**
 * How a reference is written in commit or comment text: `#12` (an issue or a
 * pull request; on Azure DevOps a work item), `!12` (a GitLab merge request),
 * `AB#12` (an Azure Boards work item).
 */
export type ReferenceSigil = '#' | '!' | 'AB#'

/** One reference whose summary the hover card asks for. */
export interface ReferenceQuery {
  sigil: ReferenceSigil
  id: number
}

/**
 * What the host says about a reference: enough for a hover card. `available`
 * is false when the host has no such item, this account may not read it, or
 * the host has no API for it — never an error, so one bad id costs one card.
 */
export interface ReferenceSummary extends ReferenceQuery {
  available: boolean
  /**
   * Why it is not available: the host has no such item or will not show it to
   * this account (`notFound`), the host is throttling (`rateLimited`), or the
   * host was not reached — no account, no API, offline (`unreachable`). `notAsked`:
   * left out of this request (a capped fallback) — the renderer keeps no answer for
   * it, so the next hover asks.
   */
  reason?: 'notFound' | 'rateLimited' | 'unreachable' | 'notAsked'
  kind?: 'issue' | 'pr' | 'mr' | 'workItem'
  title?: string
  /** GitHub, GitLab and Forgejo, normalized. */
  state?: 'open' | 'closed' | 'merged'
  /** Azure's own state name ("Active", "Resolved"): a process's vocabulary, shown as is. */
  stateName?: string
  /** Azure: Bug, User Story, Task… */
  workItemType?: string
}

/** Someone named on a pull request — an assignee or a requested reviewer. */
export interface PrPerson {
  login: string
  team?: boolean
}

export interface PrLabel {
  name: string
  /** Hex without `#` (GitHub) or with it (GitLab); absent when the host gives none. */
  color?: string
}

/** A repository issue (not a PR). */
export interface IssueInfo {
  number: number
  title: string
  author: string
  state: 'open' | 'closed'
  url: string
  comments: number
}

/** A repository milestone. */
export interface MilestoneInfo {
  number: number
  title: string
  description: string
  state: 'open' | 'closed'
  dueOn: string | null
  openIssues: number
  closedIssues: number
  url: string
}

/** A Projects v2 custom-field value on an issue (GraphQL-only). */
export interface ProjectFieldGroup {
  project: string
  fields: { name: string; value: string }[]
}

/** A pull request that closes (or, once merged, closed) an issue — GitHub's
 *  `closedByPullRequestsReferences`: closing keywords plus manual Development links. */
export interface LinkedPr {
  number: number
  title: string
  url: string
  state: 'open' | 'merged' | 'closed'
  draft: boolean
  /** `owner/name` of the PR's base repository. */
  repo: string
  /** The PR lives in another repository than the issue, so it cannot open in an in-app PR tab. */
  otherRepo: boolean
}

/** Whether `linkedPrs` is real data: `unavailable` = the host refused (scope, rate limit, error),
 *  `unsupported` = the host has no equivalent we query. */
export type LinkedPrsStatus = 'ok' | 'unavailable' | 'unsupported'

/** Full detail for one issue (all fields + conversation + linked PRs). */
export interface IssueDetail {
  number: number
  title: string
  body: string
  /**
   * The host's own rendering of `body` (GitHub's `body_html`: mentions and
   * references linked, images proxied, private attachments signed). Untrusted —
   * the page sanitizes it like any comment. `body` stays for editing.
   */
  bodyHtml?: string
  author: string
  state: 'open' | 'closed'
  url: string
  labels: string[]
  assignees: string[]
  milestone: string | null
  createdAt: string
  comments: PrComment[]
  linkedPrs: LinkedPr[]
  linkedPrsStatus: LinkedPrsStatus
  projectFields: ProjectFieldGroup[]
  /** Who the page's calls sign in as; see `PrDetail.viewer`. */
  viewer?: string | null
  viewerId?: string | null
  viewerUniqueName?: string | null
  viewerById?: boolean
}

export type PrReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
export type PrMergeMethod = 'merge' | 'squash' | 'rebase'

/** A release published on the hosting platform (GitHub). Most map 1:1 to a
 *  tag; only draft releases can be tagless until they are published. */
export interface ReleaseInfo {
  id: number
  /** Tag the release points at. Null for unpublished drafts with no tag yet. */
  tag: string | null
  name: string | null
  body: string | null
  /** ISO date; null for drafts that were never published. */
  publishedAt: string | null
  url: string
  prerelease: boolean
  draft: boolean
}

export type RepoHost = 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'forgejo'

/**
 * Where a remote's credential comes from on push and fetch — the same
 * precedence `withRemoteAuth` applies (git.ts).
 *
 * - `token` / `gh` / `git`: a profile's PAT, or its linked GitHub CLI / git
 *   helper account.
 * - `helper`: no profile credential for this host; git's own helper answers.
 * - `embedded`: a password written into the remote URL itself.
 * - `ssh`: an ssh remote — the key in the agent decides.
 * - `none`: https with nothing that would answer.
 */
export type RemoteAuthSource = 'token' | 'gh' | 'git' | 'helper' | 'embedded' | 'ssh' | 'none'

export interface RemoteAuthCheck {
  remote: string
  /** The push URL with any user:password removed. */
  url: string
  provider?: RepoHost
  source: RemoteAuthSource
  /** The profile whose credential is used, when it is one. */
  profile?: string
  /** The repository is explicitly bound to that profile (vs. the active one). */
  bound?: boolean
  /** The account the host says the credential belongs to. */
  login?: string
  /** A linked account whose credential could not be found on this machine. */
  linkMissing?: boolean
  /** A Bitbucket Data Center personal token with no user name in Settings or
   *  in the remote URL — git cannot send it. */
  needsUsername?: boolean
  /** The host refused the credential (401). */
  rejected?: boolean
  /** Scopes the host reported; absent when it does not report them (fine-grained tokens). */
  scopes?: string[]
  /** Whether the scopes allow pushing at all. Absent when unknown. */
  scopeAllowsPush?: boolean
  /** GitHub only: whether pushes that change `.github/workflows` are allowed. Absent when unknown. */
  canPushWorkflows?: boolean
}

export interface RemoteRepo {
  name: string // display name, e.g. owner/repo
  url: string // https clone url
  private?: boolean
  description?: string
  avatarUrl?: string // owner/namespace avatar from the provider
}

/** An account or organization/workspace a new repo can be created under. */
export interface RemoteOwner {
  id: string // login/slug (gh/bb), numeric namespace id (gitlab)
  login: string // display name and path segment
  avatarUrl?: string
  type: 'user' | 'org'
}

/** The authenticated identity behind a connected integration token. */
/** An organization/group/workspace the connected account belongs to. */
export interface ConnectedOrg {
  login: string
  avatarUrl?: string
  url?: string
}

export interface ConnectedAccount {
  login: string // username/handle
  name?: string // display name, if different from login
  avatarUrl?: string
  /** The address the host keeps private for this account (GitHub, GitLab). A
   *  commit with it shows this account's picture — see shared/profileAvatar.ts. */
  noreplyEmail?: string
  profileUrl?: string // link to the provider's profile page
  orgs?: ConnectedOrg[] // organizations/workspaces/groups the account belongs to
  /** Where the credential came from: the PAT typed in Settings, or the profile's
   *  link to git's credential helper or the GitHub CLI. */
  source?: 'token' | 'git' | 'gh'
  /** Set when a sign-in found a machine login to link — the caller stores it on the profile. */
  link?: AccountLink
}

export interface CreateRepoOpts {
  owner: string // user login / org / workspace slug
  ownerType: 'user' | 'org'
  ownerId?: string // gitlab namespace id
  project?: string // azure project
  name: string
  description?: string
  private: boolean
}

/** Options for opening a pull/merge request from the app. */
export interface CreatePrOpts {
  title: string
  body: string
  source: string // head branch
  target: string // base branch
  draft: boolean
  /** Optional picks, as `PrPickerPerson.id` / `PrPickerLabel.id` from `hosting:prPickerOptions`.
   *  Absent or empty: the request is exactly what it was before these existed. */
  reviewers?: string[]
  assignees?: string[]
  labels?: string[]
}

/** Result of a created PR/MR. */
export interface CreatePrResult {
  url: string
  number: number
  /** Picks the host did not take. The PR exists regardless — this only says what is missing from it. */
  metaFailed?: PrMetaField[]
}

/** The optional fields a new PR can carry besides its title and body. */
export type PrMetaField = 'reviewers' | 'assignees' | 'labels'

/** A person a PR can be handed to. `id` is what the host's API takes back: a
 *  login on GitHub and Data Center, a numeric id on GitLab, a uuid on
 *  bitbucket.org, an identity id on Azure DevOps. */
export interface PrPickerPerson {
  id: string
  login: string
  name?: string
  avatarUrl?: string
}

export interface PrPickerLabel {
  id: string
  name: string
  /** `#rrggbb`, when the host gives labels a colour. */
  color?: string
}

/** What the create dialog can offer for one remote. */
export interface PrPickerOptions {
  supports: Record<PrMetaField, boolean>
  /** The host takes a typed label it does not list yet, and creates it (GitHub, GitLab, Azure DevOps). */
  freeLabels?: boolean
  /** A person's id is their login, so one can be typed when the list could not be read (GitHub, Data Center). */
  freePeople?: boolean
  reviewers: PrPickerPerson[]
  assignees: PrPickerPerson[]
  labels: PrPickerLabel[]
  /** Supported fields whose choices could not be read. */
  failed: PrMetaField[]
  /** Fields whose list was read only in part (a cap, or a part that failed): someone may be missing. */
  partial?: PrMetaField[]
}

export interface BlameLine {
  sha: string
  author: string
  date: number
  lineNo: number
  text: string
}

export interface FileHistoryEntry {
  hash: string
  author: string
  date: number
  subject: string
}

export interface RebaseStep {
  action: 'pick' | 'squash' | 'fixup' | 'drop' | 'reword' | 'edit'
  hash: string
  subject: string
  newMessage?: string
}

export type CiState = 'success' | 'failure' | 'pending' | 'neutral'

export interface CiJob {
  name: string
  state: CiState
  url?: string
  /** Why a `neutral` job is neutral, when the host says it was not skipped —
   *  Bitbucket Data Center's CANCELLED and UNKNOWN builds. Absent: skipped. */
  neutralAs?: 'cancelled' | 'unknown'
}

/** A commit's checks counted per outcome. */
export interface CiCounts {
  passed: number
  failed: number
  pending: number
  skipped: number
  cancelled: number
  unknown: number
}

export interface CiStatus {
  state: CiState
  jobs: CiJob[]
}

// ── CI runs ──────────────────────────────────────────────────────────────────
// One vocabulary for GitHub Actions runs, GitLab pipelines, Azure Pipelines
// builds and Forgejo Actions runs, so the page never branches on the host.

/** Where a run, job or step is in its life. */
export type CiRunPhase = 'queued' | 'running' | 'completed'

/**
 * How a finished run, job or step ended. `manual` is a GitLab job waiting for
 * someone to press play; `unknown` is anything a host reports that maps to none
 * of the others.
 */
export type CiRunOutcome = 'success' | 'failure' | 'cancelled' | 'skipped' | 'manual' | 'unknown'

/** A run of a workflow / pipeline / build definition. Ids are strings: Azure's are numbers, GitLab's too, but nothing here does arithmetic on them. */
export interface CiRun {
  id: string
  /** The workflow, pipeline or build definition's name. */
  name: string
  /** What the run is about: the commit subject, or the host's display title. */
  title: string
  /** The run number the host shows (#123), when it has one apart from the id. */
  number?: number
  branch: string | null
  sha: string
  /** What started it, in the host's words: push, pull_request, schedule, manual… */
  event: string | null
  actor: string | null
  phase: CiRunPhase
  /** Null while it is not finished. */
  outcome: CiRunOutcome | null
  /** Epoch milliseconds. */
  createdAt: number
  startedAt?: number
  finishedAt?: number
  /** The run on the host's own site. */
  url: string
  /** The definition this run belongs to, for "run again on another branch". */
  workflowId?: string
  /** The pull / merge request the run was started for, when the host says. */
  pullRequest?: number
}

export interface CiRunStep {
  name: string
  phase: CiRunPhase
  outcome: CiRunOutcome | null
  startedAt?: number
  finishedAt?: number
}

export interface CiRunJob {
  id: string
  name: string
  /** GitLab's stage or Azure's stage: jobs are grouped under it when present. */
  stage?: string
  phase: CiRunPhase
  outcome: CiRunOutcome | null
  startedAt?: number
  finishedAt?: number
  url: string
  /** GitHub and Azure report the steps of a job; GitLab and Forgejo do not. */
  steps: CiRunStep[]
  /** The app can fetch this job's log itself. */
  hasLog: boolean
}

/** What a host lets the app do with runs. Decided per host, not per run. */
export interface CiRunCapabilities {
  /** Run every job again. */
  rerun: boolean
  /** Run only the jobs that failed. */
  rerunFailed: boolean
  cancel: boolean
  /** Start a workflow / pipeline on a branch. */
  dispatch: boolean
}

export interface CiRunList {
  /** False when the remote's host has no CI runs API this app speaks (Bitbucket, an old Forgejo). */
  supported: boolean
  runs: CiRun[]
  capabilities: CiRunCapabilities
}

/** A workflow / pipeline definition that can be started by hand. */
export interface CiWorkflow {
  id: string
  name: string
  /** The file it lives in, when the host says (`.github/workflows/ci.yml`). */
  path?: string
}

export type CiRunAction = 'rerun' | 'rerun-failed' | 'cancel'

export interface BranchCompareResult {
  aheadCommits: GraphCommit[]
  behindCommits: GraphCommit[]
  diff: string
}

/**
 * What a new pull request would contain, measured the way the host measures it:
 * against the remote's copy of the target branch, not the local one (which may
 * be behind after `git pull <remote> <target>` was merged into the source).
 */
export interface PrComparison {
  /** The ref compared against: `refs/remotes/<remote>/<target>`, or the local `target` as a fallback. */
  base: string
  /** False when the remote has no tracking ref for the target and the local branch stood in. */
  baseIsRemote: boolean
  /** The source's own commits on top of the base — merge commits left out. */
  commits: GraphCommit[]
  /** `git diff <base>...<source>`: the source's changes since it forked from the base. */
  diff: string
}

export interface WorktreeInfo {
  path: string
  branch: string | null
  head: string
  isMain: boolean
  isCurrent: boolean
  locked: boolean
  /** The `--reason` given when it was locked, if any. */
  lockReason: string | null
  detached: boolean
  /** The folder is gone (deleted or moved by hand) — git only has the record. */
  prunable: boolean
}

/** What a linked worktree holds that removing it would put at risk. */
export interface WorktreeStatus {
  /** Modified, staged, conflicted and untracked paths (ignored files excluded). */
  changes: number
  /** Commits ahead of / behind the upstream; both 0 without one. */
  ahead: number
  behind: number
  upstream: string | null
}

/**
 * State of a submodule, derived from `git submodule status`:
 * - `initialized`: checked out at the commit recorded by the superproject.
 * - `modified`: checked out at a different commit than recorded ('+').
 * - `uninitialized`: registered in `.gitmodules` but not checked out ('-').
 * - `conflict`: has a merge conflict ('U').
 */
export type SubmoduleStatus = 'initialized' | 'modified' | 'uninitialized' | 'conflict'

export interface SubmoduleInfo {
  /** Logical name from `.gitmodules` (the `[submodule "<name>"]` key). */
  name: string
  /** Path of the submodule within the superproject working tree. */
  path: string
  /** Configured remote URL from `.gitmodules`, if any. */
  url: string
  /** Currently checked-out commit (or recorded commit when uninitialized). */
  sha: string
  /** Commit the superproject pins this submodule to (gitlink in HEAD tree). */
  recordedSha: string
  /** Branch the submodule tracks, from `.gitmodules`, if pinned to one. */
  branch: string | null
  /** Human-readable ref shown by git, e.g. `heads/main` or `v1.0-3-gabc`. */
  describe: string | null
  status: SubmoduleStatus
  /** Commits the checkout is ahead of the recorded pointer (only when modified). */
  ahead: number
  /** Commits the checkout is behind the recorded pointer (only when modified). */
  behind: number
}

// ─── Settings / profiles ─────────────────────────────────────────────────────

export type CommitStyle =
  | 'auto'
  | 'conventional'
  | 'gitmoji'
  | 'gitmoji-conventional'
  | 'ticket'
  | 'plain'
  | 'caveman'
  | 'haiku'

/** Tone/persona used when the AI explains code. */
export type ExplainStyle = 'normal' | 'concise' | 'detailed' | 'eli5' | 'caveman' | 'pirate' | 'formal'

/** How the AI shapes the output when resolving merge conflicts. */
export type ConflictStyle = 'clean' | 'commented' | 'conservative'

/** Branch naming convention used when generating branch names with AI. */
export type BranchNamingStyle = 'prefix/description' | 'prefix/ticket-description' | 'username/prefix/description' | 'plain'

export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'groq'
  | 'mistral'
  | 'ollama'
  | 'cli'
  | 'custom'

/**
 * The wire protocol a provider speaks. Most vendors expose an OpenAI-compatible
 * surface — Google's `/v1beta/openai` and Ollama's `/v1` included — so they all
 * share one client. Anthropic does not: it serves `POST /v1/messages` with a
 * separate system field and a required `max_tokens`, which is why pointing the
 * OpenAI client at api.anthropic.com never worked.
 */
export type AITransport = 'openai' | 'anthropic' | 'cli'

/** A locally installed agent CLI that answers using its own signed-in session. */
export type AICliBinary = 'claude' | 'gemini' | 'codex' | 'devin'

export interface AIProviderPreset {
  id: AIProvider
  label: string
  endpoint: string
  defaultModel: string
  needsKey: boolean
  transport: AITransport
  /** Offline fallback, used only until a live model list has been fetched. */
  models: string[]
  /** Where this provider's key is issued, shown next to the key field. */
  keyUrl?: string
}

/**
 * Built-in providers. `models` here is a *fallback* only — the live catalogue
 * (main/aiModels.ts) is what the pickers show once a list has been fetched, so
 * a stale entry below never strands a user on an outdated model.
 */
export const AI_PROVIDERS: AIProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
    transport: 'openai',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1']
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    endpoint: 'https://api.anthropic.com',
    defaultModel: 'claude-haiku-4-5-20251001',
    needsKey: true,
    transport: 'anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-5']
  },
  {
    id: 'google',
    label: 'Google Gemini',
    // Google's OpenAI-compatible surface, so it shares the OpenAI client.
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    needsKey: true,
    transport: 'openai',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash']
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    needsKey: true,
    transport: 'openai',
    keyUrl: 'https://openrouter.ai/keys',
    models: ['openai/gpt-4o-mini', 'openai/gpt-4o', 'anthropic/claude-3.5-haiku', 'anthropic/claude-3.5-sonnet']
  },
  {
    id: 'groq',
    label: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    needsKey: true,
    transport: 'openai',
    keyUrl: 'https://console.groq.com/keys',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
  },
  {
    id: 'mistral',
    label: 'Mistral',
    endpoint: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    needsKey: true,
    transport: 'openai',
    keyUrl: 'https://console.mistral.ai/api-keys',
    models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest', 'codestral-latest']
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    endpoint: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    needsKey: false,
    transport: 'openai',
    models: ['llama3.2', 'llama3.1', 'qwen2.5-coder', 'codellama', 'mistral']
  },
  {
    id: 'cli',
    label: 'Local CLI (subscription)',
    endpoint: '',
    defaultModel: '',
    needsKey: false,
    transport: 'cli',
    models: []
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    endpoint: '',
    defaultModel: '',
    needsKey: false,
    transport: 'openai',
    models: []
  }
]

export function aiProviderPreset(id: AIProvider): AIProviderPreset {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[AI_PROVIDERS.length - 1]
}

export type SubscriptionCli = 'codex' | 'claude'
export type SubscriptionTest = 'connected' | 'missing' | 'login' | 'limit' | 'failed'

/**
 * One configured way of reaching a model: a provider, where to reach it, and
 * how it authenticates. Several can coexist — an OpenAI key for work, a
 * personal Anthropic key, a local Ollama, a signed-in CLI — and each AI feature
 * points at whichever one the user chose.
 *
 * `apiKey` is stripped from the settings JSON and stored encrypted, exactly as
 * the single key used to be (shared/secrets.ts).
 */
export interface AIAccount {
  id: string
  /** User-chosen name. Falls back to the provider label when left empty. */
  label: string
  provider: AIProvider
  /** Overrides the preset endpoint. Empty means "use the preset". */
  endpoint: string
  apiKey: string
  /** `cli` accounts only: which installed binary answers. */
  cli?: AICliBinary
  /** `cli` accounts only: an explicit path, when the binary is not on PATH. */
  cliPath?: string
  /** Require the CLI to authenticate with the user’s subscription. */
  subscription?: boolean
  /** Used by any feature that has no assignment of its own. */
  model: string
}

/**
 * The AI surfaces a user can point at a different account or model. Coarser
 * than the internal call sites on purpose: nobody wants to configure sixteen
 * dropdowns, but "cheap model for commit messages, strong one for chat" is a
 * real need.
 */
export type AIFeature = 'commit' | 'chat' | 'explain' | 'review' | 'conflict' | 'wiki' | 'theme'

export const AI_FEATURES: AIFeature[] = ['commit', 'chat', 'explain', 'review', 'conflict', 'wiki', 'theme']

/** Which account and model serve one feature. An absent model means "the account's default". */
export interface AIAssignment {
  accountId: string
  model: string
}

/**
 * A model list as the app currently knows it. `source` is what lets the UI be
 * honest: a fallback list is the bundled guess, not what the provider offers.
 */
export interface ModelCatalog {
  /** What a picker shows: chat-capable, snapshots collapsed, newest first. */
  models: string[]
  /** Every id the provider listed, for the picker's "show all" escape. */
  allModels?: string[]
  source: 'live' | 'cache' | 'fallback'
  /** Epoch ms of the fetch behind this list, or null when it never happened. */
  fetchedAt: number | null
  /** Why the list is not live. Present with `cache` and `fallback`. */
  error?: string
}

/** One agent CLI found on the machine, offered when configuring a CLI account. */
export interface DetectedCli {
  binary: AICliBinary
  label: string
  path: string
  /** Only when asked for (`detectCli({ versions: true })`) and the CLI printed one. */
  version?: string
}

export interface AIConfig {
  enabled: boolean
  /**
   * Every configured account. Populated by `migrateAIConfig` for installs that
   * predate accounts, so it is never empty in practice.
   */
  accounts: AIAccount[]
  /** The account used by any feature without its own assignment. */
  defaultAccountId: string
  /** Per-feature account + model overrides. */
  assignments: Partial<Record<AIFeature, AIAssignment>>
  /**
   * The four fields below are the *resolved* connection for one call. They stay
   * on `AIConfig` because every main-process feature function already reads
   * them: the renderer picks an account with `resolveAI(ai, feature)` and hands
   * the result over IPC, so nothing downstream had to learn about accounts.
   * On a stored config they mirror the default account.
   */
  provider: AIProvider
  endpoint: string
  apiKey: string
  model: string
  /** Which account `provider`/`endpoint`/`apiKey`/`model` came from. */
  accountId?: string
  /** Resolved from the provider preset; lets main pick a client without a lookup. */
  transport?: AITransport
  /** `cli` transport only. */
  cli?: AICliBinary
  cliPath?: string
  /** Require the CLI to authenticate with the user’s subscription. */
  subscription?: boolean
  /** `cli` transport only: working directory for the call — the repo the
   *  feature is about, so agent CLIs (devin, claude, codex) can read its files.
   *  Renderer stamps it per call; never persisted with the account. */
  cliCwd?: string
  commitStyle: CommitStyle
  explainStyle: ExplainStyle
  conflictStyle: ConflictStyle
  branchNamingStyle: BranchNamingStyle
  customInstructions: string
  generateDescription: boolean
  coAuthor: boolean
  /** Explain the token under the cursor in the file viewer. Defaults to on. */
  hoverExplain?: boolean
  /** Key held while pointing to trigger it. Defaults to Shift. */
  hoverExplainKey?: HoverModifier
  /** Repository chat. Defaults to on — but the whole surface hides with `enabled`. */
  repoChat?: boolean
  /** Model for chat only. Empty falls back to `model`. */
  repoChatModel?: string
  /** Answer from committed content only — no working-tree edits leave the
   *  machine, and uncommitted diffs are never sent. Defaults to off. */
  repoChatCommittedOnly?: boolean
  /** Chat may propose repo actions (the "Ask" action set) for the user to run.
   *  Defaults to on — proposals still never execute without the rules below. */
  repoChatActions?: boolean
  /** Prevent chat from proposing file creation, edits, replacement, or deletion.
   *  Git actions remain available. Defaults to on. */
  repoChatReadOnly?: boolean
  /** Chat may propose actions that leave the machine — fetch, pull, push,
   *  opening a pull request, submitting a stack. Defaults to off: publishing
   *  work is a decision the user opts into, not a default of the assistant. */
  repoChatRemoteActions?: boolean
  /** How chat-proposed actions run. Destructive actions always confirm,
   *  whatever the mode says. Defaults to 'ask'. */
  repoChatApproval?: ChatActionApproval
}

/**
 * Approval policy for actions proposed in repository chat, mirroring the
 * "always ask / pre-approved / allow all" ladder of editor AI assistants:
 * - 'ask': every proposal waits for a click on the card.
 * - 'auto-safe': proposals run on arrival when every action is reversible
 *   bookkeeping (stage, unstage, gitignore, branch, tag); anything else asks.
 * - 'auto-all': proposals run on arrival unless one is destructive — a
 *   destructive action always falls back to an explicit confirm.
 */
export type ChatActionApproval = 'ask' | 'auto-safe' | 'auto-all'

/** One source excerpt used to ground an answer in the repository. */
export interface RepoChatSource {
  /** Opaque identifier assigned by the main process (for example, E1). */
  id: string
  /** Repo-relative path selected from Git's tracked-file allow-list. */
  path: string
  startLine: number
  endLine: number
  /** A file pinned from outside the repository — `path` is absolute and the
   *  repository file viewer cannot open it. */
  external?: boolean
}

/** A serializable chat turn. The renderer keeps UI-only ids outside this type. */
export interface RepoChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** Present only on grounded assistant replies. */
  sources?: RepoChatSource[]
}

/**
 * A context item the user pinned to a chat turn — a file, a commit, or a file
 * from outside the repository. Pinned context is read before the model gets to
 * pick anything, so an explicit choice always survives the context budget.
 */
export type RepoChatAttachment =
  | { kind: 'file'; path: string }
  | { kind: 'commit'; hash: string }
  | { kind: 'external'; path: string }

/** Why a pinned item never reached the provider. Rendered from a key, not text. */
export type RepoChatSkipReason = 'secret' | 'binary' | 'tooLarge' | 'unreadable'

export interface RepoChatSkipped {
  /** What the user pinned, as they saw it in the chip. */
  label: string
  reason: RepoChatSkipReason
}

/** A model call that is taking long, announced so the user can decide (main/aiRequests.ts). */
export type AIRequestEvent =
  | { type: 'slow'; id: number; label: string; accountId: string }
  | { type: 'done'; id: number }

/** The user's answer to "this is taking longer than expected". */
export type AISlowChoice = { kind: 'wait' } | { kind: 'cancel' } | { kind: 'switch'; accountId: string }

/** What the repository chat is doing right now, for the panel's waiting line. */
export type RepoChatProgressStep = { phase: 'thinking' } | { phase: 'reading'; files: number }

/** A progress step as it crosses IPC, tagged with the repository it belongs to. */
export type RepoChatProgress = RepoChatProgressStep & { repoPath: string }

/** Answer returned by the repository-chat IPC handler. */
export interface RepoChatReply {
  content: string
  sources: RepoChatSource[]
  /** Pinned context that was refused, so the panel can say so instead of lying. */
  skipped: RepoChatSkipped[]
  /** Validated repo actions the model proposed. Never executed in main — the
   *  renderer renders them as a card and runs them only under the approval
   *  policy. Absent when the chat-actions setting is off. */
  actions?: RepoChatAction[]
  /** Something the app itself must say, whatever the model wrote — set when a
   *  file change was asked for while File read-only mode is on. */
  notice?: 'file-read-only' | 'file-not-prepared'
}

/** Co-author trailer appended when AIConfig.coAuthor is enabled (default on). */
// This build credits its author: the GitHub noreply address ties the trailer
// to the account without exposing a real e-mail.
export const APP_COAUTHOR = 'Starley - Mestre Jedi <9012499+StarleyDev@users.noreply.github.com>'

/** Error-message marker thrown by `fileContent`/`fileDataUrl` when a file
 *  exceeds the in-memory size cap. The byte count follows the colon; the
 *  renderer parses it to show the size and offer "load anyway" (force=true). */
export const FILE_TOO_LARGE_PREFIX = 'GITHUTTBR_FILE_TOO_LARGE:'

// ─── Generated repo wiki ────────────────────────────────────────────────────

/** Share of the codebase written in one language, counted by bytes. */
export interface LanguageStat {
  language: string
  bytes: number
  files: number
  /** 0–1, of the code counted (config and docs excluded). */
  share: number
}

/** A dependency exactly as a manifest declares it. */
export interface DependencyRef {
  name: string
  version: string
  dev: boolean
}

/** Counted facts about a repo — no model involved. */
export interface RepoFacts {
  languages: LanguageStat[]
  totalBytes: number
  manifests: string[]
  dependencies: DependencyRef[]
}

/** One folder in the import graph. */
export interface ImportNode {
  id: string
  files: number
  /** Imports this folder makes into other folders. */
  out: number
  /** Imports other folders make into this one. */
  in: number
}

export interface ImportEdge {
  from: string
  to: string
  count: number
}

/** Folder-level import graph, read from the source with no model involved. */
export interface ImportGraph {
  nodes: ImportNode[]
  edges: ImportEdge[]
  depth: number
  /** Imports that pointed at a file in this repo. */
  resolved: number
  /** Imports that pointed outside it (packages, stdlib). */
  external: number
  omittedEdges: number
}

/** One dependency, placed and explained by the model. */
export interface TechItem {
  dep: string
  role: string
}

export interface TechGroup {
  name: string
  items: TechItem[]
}

/** The model's reading of the declared dependencies. */
export interface TechStack {
  summary: string
  groups: TechGroup[]
}

export type WikiArchetype = 'overview' | 'module' | 'workflow' | 'reference'

/** One planned page: what it covers, before anything has been written. */
export interface WikiPagePlan {
  slug: string
  title: string
  archetype: WikiArchetype
  /** Repo-relative files this page is about. */
  scopePaths: string[]
}

export interface WikiPlan {
  pages: WikiPagePlan[]
}

/** One statement, with the files that back it up. */
export interface WikiClaim {
  text: string
  sourcePaths: string[]
}

export interface WikiSection {
  heading: string
  claims: WikiClaim[]
}

export interface WikiPage {
  slug: string
  title: string
  archetype: WikiArchetype
  summary: string
  sections: WikiSection[]
  /** Slugs of other pages in the same wiki. */
  related: string[]
  /** Rendered by the app from the sections above. */
  markdown: string
}

/** A generated wiki for one repository, as stored on disk. */
export interface RepoWiki {
  headSha: string
  generatedAt: number
  model: string
  promptVersion: string
  pages: WikiPage[]
  /** The model's grouping of the dependencies the manifests declare. */
  stack: TechStack | null
}

/** Progress pushed while a wiki is being generated. */
export type WikiProgress =
  | { phase: 'planning' }
  | { phase: 'page'; slug: string; title: string; done: number; total: number }
  | { phase: 'done' }
  | { phase: 'error'; message: string }

/** Key that must be held for hover-to-explain to fire. */
export type HoverModifier = 'shift' | 'alt' | 'ctrl' | 'meta' | 'none'

/** One line of source as the viewer shows it, with its real file line number. */
export interface NumberedLine {
  no: number
  text: string
}

/** What the hover explainer needs to answer about one token. */
export interface HoverExplainRequest {
  path: string
  lang: string
  token: string
  line: number
  lines: NumberedLine[]
}

/** A scoped inline-edit request: replace `startLine..=endLine` (1-based,
 * inclusive) of `file` to satisfy `instruction`. */
export interface EditSelectionRequest {
  file: string
  lang: string
  startLine: number
  endLine: number
  /** The exact text of the selected lines. */
  code: string
  /** Neighbouring lines for context only — the model must not re-emit them. */
  contextBefore: string
  contextAfter: string
  instruction: string
}

/** A short explanation of a hovered token, citing lines from the window it saw. */
export interface HoverExplainResult {
  summary: string
  bullets: string[]
  lines: number[]
  startLine: number
  endLine: number
}

/** One AI PR-review finding, anchored to a real hunk of the reviewed diff. */
export interface PRReviewFinding {
  kind: 'risk' | 'suggestion'
  severity: 'high' | 'medium' | 'low'
  path: string
  line: number
  claim: string
  suggestion: string
}

export interface PRReviewResult {
  summary: string
  /** Findings rendered as markdown, kept for plain-text consumers. */
  risks: string
  suggestions: string
  findings: PRReviewFinding[]
}

/** A single repo mutation produced by the AI "Ask" feature, ready to execute. */
export type AskAction =
  | { type: 'gitignore'; patterns: string[]; description: string }
  | { type: 'stage'; files: string[]; description: string }
  | { type: 'unstage'; files: string[]; description: string }
  | { type: 'commit'; message: string; files?: string[]; description: string }
  | { type: 'stash'; files?: string[]; message?: string; description: string }
  | { type: 'discard'; files: string[]; description: string }
  | { type: 'branch'; name: string; at?: string; checkout?: boolean; description: string }
  | { type: 'checkout'; ref: string; description: string }
  | { type: 'tag'; name: string; message?: string; description: string }
  | { type: 'fetch'; remote?: string; description: string }
  | { type: 'pull'; mode?: 'default' | 'ff-only' | 'rebase'; description: string }
  /** Never carries a force flag — a rewrite of published history is not
   *  something a model may propose. */
  | { type: 'push'; branch?: string; remote?: string; description: string }
  | { type: 'merge'; ref: string; noFf?: boolean; description: string }
  | { type: 'rebase'; onto: string; description: string }
  | { type: 'revert'; hashes: string[]; description: string }
  | { type: 'cherry_pick'; hashes: string[]; description: string }
  | {
      type: 'open_pr'
      title: string
      body?: string
      /** Defaults to the checked-out branch. */
      source?: string
      target: string
      draft?: boolean
      description: string
    }
  /** Push every level of a stack and open or retarget one pull request each,
   *  the same run the Stack modal's Submit performs. GitHub only. */
  | { type: 'stack_submit'; leaf?: string; description: string }

/** A provider-portable repository file mutation proposed by repository chat. */
export type RepoChatFileAction =
  | {
      type: 'edit_file'
      path: string
      oldText: string
      newText: string
      replaceAll?: boolean
      description: string
    }
  | {
      type: 'write_file'
      path: string
      content: string
      mode: 'create' | 'replace'
      description: string
    }
  | { type: 'delete_file'; path: string; description: string }

/** A file mutation after the main process has verified it and built its diff. */
export type PreparedRepoChatFileAction = RepoChatFileAction & {
  expectedHash: string | null
  expectedOccurrences?: number
  preview: string
}

/** Repository chat can mutate files first and then run the existing Git actions. */
export type RepoChatAction = AskAction | PreparedRepoChatFileAction

export type RepoChatActionErrorCode =
  | 'unsafe_path'
  | 'git_internal_path'
  | 'symlink_path'
  | 'secret_file'
  | 'ignored_path'
  | 'generated_path'
  | 'binary_file'
  | 'file_too_large'
  | 'batch_too_large'
  | 'evidence_required'
  | 'incomplete_evidence'
  | 'not_found'
  | 'already_exists'
  | 'stale_file'
  | 'old_text_missing'
  | 'ambiguous_edit'
  | 'no_staged_changes'
  | 'hook_failed'
  | 'rollback_failed'
  | 'unknown'

export type RepoFileBatchResult =
  | { ok: true; applied: number }
  | {
      ok: false
      error: { code: RepoChatActionErrorCode; detail?: string; paths?: string[] }
    }

export interface RepoChatExecutionResult {
  applied: number
  failedIndex?: number
  failedType?: RepoChatAction['type']
  /** `detail` is English: the whole result is handed to the model. When the
   *  failure is GitHuttBr's own copy, `detailKey` names it so the UI can show it
   *  in the user's language instead. */
  error?: { code: RepoChatActionErrorCode; detail?: string; detailKey?: string; paths?: string[] }
  remaining: number
  actionResults: Array<{
    index: number
    type: RepoChatAction['type']
    status: 'done' | 'failed' | 'skipped'
  }>
  /** Guard snapshot taken before the plan ran, when it could touch the working
   *  tree. What the card's "Undo" restores. */
  snapshot?: { sha: string; head: string }
  /** Pull requests the plan opened or retargeted — the card links them, because
   *  a PR that appears silently is indistinguishable from none. */
  prs?: Array<{ number: number; url: string; branch?: string; base?: string; action?: 'create' | 'retarget' | 'ok' }>
}

// ─── Launch configurations (VS Code-style .vscode/launch.json) ──────────────

/** One entry from a `.vscode/launch.json` `configurations` array. Only the
 *  fields GitHuttBr actually runs are typed; the rest is preserved opaquely. */
export interface LaunchConfig {
  name: string
  type?: string
  request?: string
  program?: string
  cwd?: string
  args?: string[]
  env?: Record<string, string>
  /** Path to a dotenv file whose KEY=VALUE pairs are added to the environment. */
  envFile?: string
  runtimeExecutable?: string
  runtimeArgs?: string[]
  /** Label of a task in the sibling tasks.json to run before launching. */
  preLaunchTask?: string
  /** Label of a task to run after the program exits. */
  postDebugTask?: string
  /** Controls visibility / ordering of the entry in the picker. */
  presentation?: { hidden?: boolean; group?: string; order?: number }
  /** Synthetic field (set during discovery) for a `compounds` entry: the member
   *  configuration names to run, in order. */
  compound?: string[]
  /** Synthetic field (set during discovery): the compound's `stopAll` — stopping
   *  one member session stops all of them, like VS Code. */
  compoundStopAll?: boolean
  /** Watch the session's output and open a URL once the server announces it. */
  serverReadyAction?: { pattern?: string; uriFormat?: string; action?: string }
  [key: string]: unknown
}

/** One entry from a `.vscode/tasks.json` `tasks` array (subset GitHuttBr runs). */
export interface LaunchTask {
  label: string
  type?: string
  command?: string
  args?: string[]
  /** npm-task script name (`"type": "npm"`, `"script": "build"`). */
  script?: string
  options?: { cwd?: string; env?: Record<string, string> }
  /** Other task label(s) to run first. */
  dependsOn?: string | string[]
  /** "sequence" runs dependsOn one-by-one; otherwise they're independent. */
  dependsOrder?: 'sequence' | 'parallel'
  /** A watch/server task that never exits — GitHuttBr won't block the launch on it. */
  isBackground?: boolean
  [key: string]: unknown
}

/** One `${input:id}` definition from the `inputs` array of a launch.json. We
 *  support the editor-free kinds: a free-text `promptString` and a static
 *  `pickString`. (`command`-backed inputs need the VS Code command palette.) */
export interface LaunchInput {
  id: string
  type: 'promptString' | 'pickString' | string
  description?: string
  default?: string
  /** Options for a `pickString`. Each is either a raw value or {label,value}. */
  options?: (string | { label?: string; value: string })[]
  password?: boolean
  /** GitHuttBr: replace ${fileValue:name} in description/default with a JSON/YAML scalar. */
  fileValues?: Record<string, { file: string; key: string }>
}

export type LaunchInputResolution =
  | { inputs: LaunchInput[] }
  | { error: { id: string; source: string; reason: 'file' | 'type' } }

/** All launch configs discovered under one `.vscode/` folder. The root folder's
 *  group renders first; deeper folders follow after a divider. */
export interface LaunchGroup {
  /** Stable id — the absolute workspace-folder path (parent of `.vscode`). */
  id: string
  /** Absolute workspace folder (the directory that contains `.vscode/`). */
  dir: string
  /** Display label: "Workspace" for the repo root, else the relative path. */
  label: string
  isRoot: boolean
  configs: LaunchConfig[]
  tasks: LaunchTask[]
  /** `inputs` definitions, used to prompt for `${input:id}` before launching. */
  inputs: LaunchInput[]
  /** The folder's `package.json` scripts — how the renderer sees through an
   *  `npm run dev` to the dev server it actually starts. Empty when there is
   *  no package.json. */
  scripts: Record<string, string>
}

export type LaunchStatus = 'running' | 'paused' | 'exited'

/** How eagerly the Problems dock runs the project's analyzers. */
export type AnalyzerMode = 'onOpen' | 'manual' | 'off'

/** One diagnostic from a project's own analyzer, normalised across tools. */
export type ProblemSeverity = 'error' | 'warning' | 'info'

export interface Problem {
  /** Repo-relative, forward slashes — the key the UI groups and filters on. */
  file: string
  line: number
  col: number
  severity: ProblemSeverity
  message: string
  /** The tool's own code (`TS2304`, `unused_import`, an ESLint rule id). */
  code?: string
  /** Which analyzer said so (`dart`, `tsc`, `eslint`, …). */
  source: string
}

export interface AnalyzeResult {
  problems: Problem[]
  /** Analyzers that ran, in the order they finished. */
  ran: string[]
  /** Analyzers the project asks for but the machine could not run. */
  missing: string[]
  /** True when the problem list hit its cap and was cut short. */
  truncated: boolean
  /** Wall-clock of the whole sweep, for the panel's footer. */
  ms: number
}

/** A test runner the panel knows how to drive and read. */
export type TestRunner = 'vitest' | 'jest'

export type TestStatus = 'passed' | 'failed' | 'skipped'

/** One test, as the runner's JSON report describes it. */
export interface TestCase {
  /** Describe blocks and the test title, joined: `parser › handles empty input`. */
  name: string
  status: TestStatus
  ms: number
  /** The first failure message, colour codes stripped and capped. */
  message?: string
  /** Where it failed in the test file (1-based), when the stack says so. */
  line?: number
}

export interface TestFile {
  /** Repository-relative path, forward slashes. */
  file: string
  status: TestStatus
  tests: TestCase[]
}

export interface TestRunResult {
  runner: TestRunner
  files: TestFile[]
  passed: number
  failed: number
  skipped: number
  ms: number
  /** Set when the runner produced no report — what it printed instead (may be empty). */
  error?: string
  /** The run hit its time limit and was stopped. */
  timedOut?: boolean
  /** The user stopped it: nothing to show, keep the previous result. */
  cancelled?: boolean
  /** No runner to run: the panel already explains why. */
  unavailable?: boolean
}

/**
 * One TODO-style marker found in the repository's own source, the way an editor's
 * todo tree shows them — the tag, who it was addressed to, and where it lives.
 */
export interface CodeTodo {
  /** Repo-relative, forward slashes. */
  file: string
  line: number
  /** 1-based column of the tag itself, so opening the file lands on the marker. */
  col: number
  /** Normalised upper-case tag — `todo`, `Todo` and `TODO` are one bucket. */
  tag: string
  /** Owner from `TODO(cgm)`, `TODO (cgm)` or `TODO: @cgm`, lower-cased. Absent means unassigned. */
  owner?: string
  /** The note itself, with the tag, the owner and any separator removed. */
  message: string
  /** The whole source line, trimmed — the tooltip, and what the row falls back to. */
  text: string
}

export interface TodoScanResult {
  todos: CodeTodo[]
  /** True when the scan hit its cap and was cut short. */
  truncated: boolean
  /** Wall-clock of the sweep, for the panel's footer. */
  ms: number
}

/** Where a launch config can be pointed: a handset, a simulator, this desktop. */
export type DevicePlatform = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'web' | 'other'

/** Which SDK tool reported a device — it also decides how the device is booted. */
export type DeviceSource = 'flutter' | 'flutter-emulator' | 'simctl' | 'adb' | 'avd'

export interface RunDevice {
  /** The value the runtime wants (`flutter run -d <id>`, `--udid`, `--target`). */
  id: string
  name: string
  platform: DevicePlatform
  kind: 'device' | 'simulator' | 'desktop' | 'web'
  /** Booted and able to take a run right now. */
  running: boolean
  source: DeviceSource
  /** Secondary line for the picker — an OS version, a serial. */
  detail?: string
}

export interface RunDeviceSnapshot {
  devices: RunDevice[]
  /** SDK tools that answered nothing, so the UI can explain a short list. */
  missing: string[]
}

/** A full app backup: settings plus the separate info & vault stores. Written
 *  by Settings → Data → Export. `vault` and the profile API tokens are only
 *  present when the user opts into "include secrets"; `info` is always included
 *  (non-secret). Analytics/usage live in their own machine-local store and are
 *  never exported. */
export interface SettingsBundle {
  /** The export marker. An export carrying any other app's marker is refused. */
  __githuttbr: 'settings-export'
  version: 1
  /** Only the parts chosen at export time: a part left out is absent, and the
   *  import reads a missing key as "leave this machine's value alone". */
  settings: Partial<AppSettings>
  info?: InfoExport
  vault?: VaultExport
  /** Profile pictures chosen as an image, by profile id, as PNG data URLs. */
  avatars?: Record<string, string>
}

/** Result of interpreting a free-form instruction against the repo's current state. */
export interface AskPlan {
  /** One-line, human-readable summary of what will happen. */
  summary: string
  /** Ordered actions to apply. Empty if the instruction can't be fulfilled. */
  actions: AskAction[]
  /** Set when the instruction is unsupported/ambiguous; actions is then empty. */
  note?: string
}

// ─── Analytics & instrumentation ─────────────────────────────────────────────

/** Accumulated token counts (and estimated cost) for a slice of AI usage. */
export interface AIUsageStat {
  requests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** Estimated USD, computed from a built-in price table. 0 if model unknown. */
  cost: number
}

export function emptyAIUsageStat(): AIUsageStat {
  return { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 }
}

/** Activity events recorded as the user drives githuttbr. */
export type ActivityEvent =
  | 'commit'
  | 'amend'
  | 'push'
  | 'pull'
  | 'fetch'
  | 'branchCreate'
  | 'branchDelete'
  | 'merge'
  | 'rebase'
  | 'stash'
  | 'stashPop'
  | 'conflictResolved'
  | 'tagCreate'
  | 'cherryPick'
  | 'revert'
  | 'repoOpen'
  | 'clone'
  | 'init'

/** One local calendar day of recorded activity. */
export interface DayBucket {
  date: string // 'YYYY-MM-DD' (local time)
  events: Partial<Record<ActivityEvent, number>>
  ai: AIUsageStat
}

/**
 * Persisted, machine-local activity ledger. Holds a per-day timeline plus
 * lifetime AI token totals (broken down by feature and model).
 */
export interface Analytics {
  /** Unix ms of the first recorded entry, 0 when nothing recorded yet. */
  since: number
  /** Days of history to keep; 0 = keep forever. Older buckets are pruned. */
  retentionDays: number
  days: DayBucket[]
  aiTotal: AIUsageStat
  aiByFeature: Record<string, AIUsageStat>
  aiByModel: Record<string, AIUsageStat>
}

export function emptyAnalytics(): Analytics {
  return { since: 0, retentionDays: 0, days: [], aiTotal: emptyAIUsageStat(), aiByFeature: {}, aiByModel: {} }
}

/** One recorded git operation, kept as a machine-local, append-only log. */
export interface LogEntry {
  /** Unix ms when the operation finished. */
  ts: number
  /** Filesystem path of the repository the operation ran against ('' for app-level ops). */
  repoPath: string
  /** Display name (basename of repoPath), '' for app-level ops. */
  repoName: string
  /** Which activity the operation maps to. */
  event: ActivityEvent
  /** Whether the operation completed successfully. */
  ok: boolean
  /** Truncated error message when `ok` is false. */
  error?: string
}

/** Aggregated commit history for a single repository, read from `git log`. */
export interface RepoStats {
  totalCommits: number
  first: number // unix seconds of oldest commit in range, 0 if none
  last: number // unix seconds of newest commit, 0 if none
  perDay: { date: string; count: number }[]
  authors: { name: string; commits: number }[]
}

/** Per-file change frequency + line churn — the "hotspots" of a repo. */
export interface FileHotspot {
  path: string
  commits: number // number of commits that touched this file
  added: number
  removed: number
}

/** Per-author contribution totals. */
export interface AuthorStat {
  name: string
  commits: number
  added: number
  removed: number
}

/** A weekly churn bucket (lines added/removed, commit count). */
export interface ChurnPoint {
  week: string // ISO date of the week's Monday
  added: number
  removed: number
  commits: number
}

/** Aggregated repository insights from a single `git log --numstat` pass. */
export interface RepoInsights {
  totalCommits: number
  first: number // unix seconds of oldest commit in range
  last: number // unix seconds of newest commit
  filesTouched: number
  authors: AuthorStat[]
  hotspots: FileHotspot[]
  churn: ChurnPoint[]
}

/** One file touched by a commit, with numstat line counts ("-" for binary counted as 0). */
export interface CosmosFileTouch {
  path: string
  added: number
  removed: number
}

/** Per-commit record for the 3D repo-history visualization ("RepoCosmos" easter egg). */
export interface CosmosCommit {
  hash: string
  parents: string[]
  authorName: string
  authorEmail: string
  timestamp: number // unix seconds
  subject: string
  files: CosmosFileTouch[] // empty for merge commits
}

/** Output of the conventional-commit changelog generator. */
export interface ChangelogResult {
  markdown: string
  count: number // commits included
}

/** One secret stored in the local, OS-keychain-encrypted vault. */
export interface VaultEntry {
  id: string
  key: string
  value: string
  note?: string
  updatedAt: number
}

/** Vault contents for a repo: its own entries plus the cross-repo global ones. */
export interface VaultListResult {
  available: boolean // OS encryption (safeStorage) usable on this machine
  /** The vault file exists but could not be read: shown empty, and every write is refused. */
  unreadable?: boolean
  /** With `available: false` from listing: whether a vault file exists that the keychain could not open. */
  onDisk?: boolean
  repo: VaultEntry[]
  global: VaultEntry[]
}

/** Whole-vault payload for backup/transfer (all repos + global). */
export interface VaultExport {
  repos: Record<string, VaultEntry[]>
  global: VaultEntry[]
}

/** `vault:exportAll`'s answer: `unreadable` when the vault exists and could not
 *  be read — then it is empty, and must not be exported as the vault. */
export interface VaultExportReply extends VaultExport {
  unreadable?: boolean
  /** A vault exists, but the OS keychain is off or did not answer: it could not be opened. */
  unavailable?: boolean
}

/** `vault:importAll`'s answer: `unreadable` when the local vault could not be
 *  read, so nothing was merged into it. */
export interface VaultImportReply {
  unreadable?: boolean
  /** There were entries to merge, and the OS keychain could not take them. */
  unavailable?: boolean
}

/** Whole-info payload for backup/transfer (all repos). */
export interface InfoExport {
  repos: Record<string, InfoEntry[]>
}

// ─── Secure share (.githuttbr bundles) ─────────────────────────────────────────

/** A repo file offered in the secure-share export picker. */
export interface SecureShareCandidate {
  path: string // relative to the repo root, forward slashes
  size: number
  secret: boolean // matches the secret-file heuristics — preselected in the UI
}

/** Plaintext envelope of a .githuttbr bundle, readable without the password. A v1
 *  bundle carries a single repo's files (project/fileCount only); a v2 bundle
 *  carries N sections (repos + the global vault) summarised in `sections`. */
export interface SecureBundleHeader {
  project: string
  createdAt: number
  fileCount: number // total repo files across all sections (0 for a vault-only bundle)
  version?: number // 1 = legacy single-repo, 2 = multi-section
  sections?: SecureBundleSectionSummary[] // present on v2 — one entry per tab
}

/** A repo reference inside a portable workspace: matched on the receiving
 *  machine by remote URL first, folder name second — never by absolute path. */
export interface SecureWorkspaceRepo {
  name: string
  remote?: string
  folder: string
}

/** One tab of a portable workspace: a bare repo, or a group carrying repos. */
export type SecureWorkspaceTab =
  | { kind: 'repo'; repo: SecureWorkspaceRepo }
  | { kind: 'group'; name: string; color?: string; repos: SecureWorkspaceRepo[] }

/** Per-section summary in a v2 envelope, readable before the password is entered
 *  (so the import UI can show tabs and match repos). No secret values here. */
export type SecureBundleSectionSummary =
  | { kind: 'repo'; project: string; folder: string; remote?: string; fileCount: number }
  | { kind: 'vault'; entryCount: number }
  | { kind: 'workspace'; name: string; tabCount: number; repoCount: number }
  | { kind: 'notes'; folder: string; remote?: string; ref: string; noteCount: number }

/** A decrypted v2 bundle, sanitised for the renderer: file lists and vault keys,
 *  but never file contents or secret values (those stay in the main process). */
export interface SecureBundleOpened {
  version: number
  sections: SecureOpenedSection[]
}

export type SecureOpenedSection =
  | {
      kind: 'repo'
      project: string
      folder: string
      remote?: string
      files: { path: string; size: number; executable?: boolean }[]
    }
  | { kind: 'vault'; entries: { key: string; note?: string }[] }
  | { kind: 'workspace'; name: string; tabs: SecureWorkspaceTab[] }
  | { kind: 'notes'; folder: string; remote?: string; ref: string; noteCount: number }

/** What the export UI asks the main process to pack. Repo file contents, vault
 *  values and note bodies are read in main — the renderer only names what to
 *  include (and, for a workspace, hands over the already-portable tab shape). */
export type SecureExportSpec =
  | { kind: 'repo'; repoPath: string; project: string; folder: string; remote?: string; paths: string[] }
  | { kind: 'vault' }
  | { kind: 'workspace'; name: string; tabs: SecureWorkspaceTab[] }
  | { kind: 'notes'; repoPath: string; folder: string; remote?: string }

/** How the import UI wants each section applied. Repo and notes sections target
 *  a chosen local repo; the vault section merges into the global vault. A
 *  workspace section is applied by the renderer (it owns the settings store). */
export type SecureApplyPlan =
  | { kind: 'repo'; sectionIndex: number; targetRepoPath: string; paths: string[] }
  | { kind: 'vault'; sectionIndex: number; keys: string[] }
  | { kind: 'notes'; sectionIndex: number; targetRepoPath: string; overwrite: boolean }

export interface SecureApplyResult {
  filesWritten: number
  secretsWritten: number
  notesWritten: number
  /** Notes not applied: the commit is absent locally, or a differing note existed and overwrite was off. */
  notesSkipped: number
}

/** Preview of one bundled note against a chosen target repo. */
export interface SecureNotePreviewEntry {
  sha: string
  /** The annotated commit exists in the target repo. */
  commitExists: boolean
  /** 'new' = no local note; 'same' = identical note; 'different' = would need overwrite. */
  state: 'new' | 'same' | 'different'
}

/** One decrypted bundle entry, previewed before writing into the repo. */
export interface SecureSharePreviewEntry {
  path: string
  size: number
  exists: boolean // a file already sits at this path in the target repo
  safe: boolean // path cannot escape the repo (unsafe entries are never written)
}

export type SecureShareError =
  | 'invalid' // not a .githuttbr bundle / malformed
  | 'bad-password' // wrong password or tampered payload (GCM auth failed)
  | 'unsupported-version' // bundle written by a newer githuttbr
  | 'read-failed'
  | 'write-failed'
  | 'vault-unreadable' // the local vault could not be read, so nothing was merged into it
  | 'vault-unavailable' // the OS keychain could not open the vault, so it was neither packed nor merged

/** A non-private, per-repo info field (App ID, website, social links…). Stored
 *  in plaintext — unlike the vault, this is reference metadata, not secrets. */
export interface InfoEntry {
  id: string
  /** Display label, e.g. "Bundle ID". */
  label: string
  /** The value itself, e.g. "com.acme.app" or a URL/handle. */
  value: string
  /** Key into the field-preset catalog (chooses the icon + link behaviour). */
  field: string
  updatedAt: number
}

/** What triggered a WIP snapshot. */
export type SnapshotKind = 'auto' | 'manual' | 'guard'

/**
 * The changes a discard is about to throw away, saved so Undo can put them back
 * exactly: what was staged (the index as a tree) and what was on disk (the
 * working tree, untracked files included). Plain git objects, no ref.
 */
export interface SavedWork {
  index: string
  worktree: string
}

/** A saved WIP snapshot (a commit of the whole working tree kept under refs/githuttbr/wip). */
export interface SnapshotInfo {
  ref: string // full ref name (refs/githuttbr/wip/<ts>-<a|m|g>)
  sha: string
  time: number // unix seconds
  files: number // changed files captured
  kind: SnapshotKind // timer, user action, or pre-destructive guard
}

/** Progress event streamed from `git clone --progress` while a clone runs. */
export interface CloneProgress {
  /** The `CloneOptions.cloneId` this progress belongs to — several clones can run at once. */
  cloneId?: string
  stage: string // 'counting' | 'compressing' | 'receiving' | 'resolving' | 'checking out' | ...
  progress: number // 0–100 for the current stage
  processed: number
  total: number
}

/**
 * Everything the clone dialog can ask `git clone` for beyond the URL. All of it
 * is optional: an empty object is a plain full clone of the remote's default
 * branch.
 */
export interface CloneOptions {
  /** Host the URL belongs to, for credential injection. */
  host?: RepoHost
  /** Token for that host — used for this clone only, never written to config. */
  token?: string
  /** The profile picked in the clone dialog — the one the new repository is
   *  bound to. A self-hosted server's token (GitLab, Forgejo, Enterprise
   *  Server, Data Center) is read from it, for every tab; an empty or unknown id
   *  gets none. Absent: the active profile. */
  profileId?: string
  /** Partial clone spec for `--filter`, e.g. `blob:none`. */
  filter?: string
  /** Shallow clone: keep only this many commits of history. */
  depth?: number
  /** Fetch only the checked-out branch. `false` alongside `depth` restores the
   *  other branches that `--depth` would otherwise drop. */
  singleBranch?: boolean
  /** Branch or tag to check out instead of the remote's default HEAD. */
  branch?: string
  /** Also clone submodules, recursively. */
  recurseSubmodules?: boolean
  /** Renderer-chosen id that tags this clone's progress and lets `cancelClone` stop it. */
  cloneId?: string
}

/** The three git-flow branch kinds GitHuttBr automates. */
export type GitflowKind = 'feature' | 'release' | 'hotfix'

/**
 * A repository's git-flow layout. Read from — and written to — the same
 * `gitflow.*` git config keys the `git flow` CLI uses, so a repo initialised by
 * either tool is understood by the other.
 */
export interface GitflowConfig {
  /** The released branch: `gitflow.branch.master`. */
  main: string
  /** The integration branch: `gitflow.branch.develop`. */
  develop: string
  featurePrefix: string
  releasePrefix: string
  hotfixPrefix: string
  /** Prepended to a release/hotfix name to form its tag, e.g. `v`. */
  versionTagPrefix: string
}

/** What the dialog needs to know about the repository right now. */
export interface GitflowStatus {
  config: GitflowConfig
  /** True when `gitflow.*` config exists — i.e. the layout is set up. */
  initialized: boolean
  /** Whether the configured branches actually exist locally. */
  hasMain: boolean
  hasDevelop: boolean
  current: string
  /** Set when the current branch is a flow branch: its kind and bare name. */
  currentFlow: { kind: GitflowKind; name: string } | null
}

/** Refs as they stood before a finish, so the whole thing can be undone. */
export interface GitflowSnapshot {
  refs: { name: string; sha: string }[]
  /** Tag created by the finish, if any. */
  tag: string | null
  /** The finished branch, recreated by an undo at this sha. */
  branch: { name: string; sha: string }
}

/** What removing a path from history would cost, measured before agreeing to it. */
export interface HistoryPurgePreview {
  /** Paths as given, echoed back. */
  paths: string[]
  /** Commits anywhere in the repository that touch them. */
  commits: number
  /** Oldest touching commit — everything after it gets a new hash. */
  firstCommit: { sha: string; subject: string; date: number } | null
  /** Branches and tags that would be rewritten. */
  branches: string[]
  tags: string[]
  /** Bytes held by the blobs at those paths, across all history. */
  bytes: number
  /** Why the rewrite cannot start right now — empty when it can. */
  blocked: string
}

/** A path that exists somewhere in history, with what it costs to keep it. */
export interface HistoryPathEntry {
  path: string
  /** Bytes held by every version of it, across all history. */
  bytes: number
  /** How many distinct blobs — i.e. how often it changed. */
  versions: number
  /** True when the path is no longer in the working tree's index. */
  deleted: boolean
}

/** A safety copy of every ref as it stood before a purge. */
export interface HistoryPurgeBackup {
  /** `refs/githuttbr/pre-purge/<timestamp>`. */
  prefix: string
  /** Epoch seconds, the timestamp in the prefix. */
  at: number
  /** How many refs it holds. */
  refs: number
  /** The paths that were purged, recorded alongside for the UI. */
  paths: string[]
}

export interface HistoryPurgeResult {
  backup: HistoryPurgeBackup
  /** Refs the rewrite actually changed. */
  rewritten: number
}

/** Outcome of pushing to one remote, when several were asked for at once. */
export interface PushRemoteResult {
  remote: string
  ok: boolean
  /** git's message when `ok` is false. */
  error: string
}

/**
 * Where a local branch stands against one remote, for the "Push branches"
 * dialog. Computed from the remote-tracking refs, so it is as fresh as the
 * last fetch — the push itself is what has the final word.
 */
export type BranchPushStateKind = 'ahead' | 'new' | 'upToDate' | 'behind' | 'diverged'

export interface BranchPushState {
  name: string
  sha: string
  isCurrent: boolean
  /** The configured upstream, short form (`origin/feature`), or null. */
  upstream: string | null
  /** The branch it lands on by default at the chosen remote: always its own
   *  name, as `git push` with `push.default=simple` would. */
  remoteBranch: string
  /** Whether `<remote>/<remoteBranch>` exists as a remote-tracking ref. */
  remoteExists: boolean
  /** Counted against `<remote>/<remoteBranch>`, not against the upstream. */
  ahead: number
  behind: number
  state: BranchPushStateKind
  /** Set when the branch tracks a branch of another name on this remote —
   *  `git checkout -b feature origin/main`. Pushing there is an explicit,
   *  confirmed choice, never the default. */
  upstreamTarget: UpstreamPushTarget | null
}

/** The other destination a branch could be pushed to: its upstream's name. */
export interface UpstreamPushTarget {
  /** The upstream's branch name on the remote (`main`). */
  remoteBranch: string
  remoteExists: boolean
  ahead: number
  behind: number
  state: BranchPushStateKind
  /** The remote's default branch (`refs/remotes/<remote>/HEAD`), when known. */
  isRemoteDefault: boolean
}

/** How one branch of a multi-branch push came out, from `git push --porcelain`. */
export type BranchPushStatus = 'pushed' | 'created' | 'upToDate' | 'rejected' | 'notAttempted'

/** Why git refused a ref, normalised so the UI can explain it in any language. */
export type BranchPushRejection = 'nonFastForward' | 'fetchFirst' | 'atomic' | 'remoteRejected' | 'other'

export interface BranchPushResult {
  branch: string
  remoteBranch: string
  status: BranchPushStatus
  /** Set when `status` is `rejected`. */
  rejection?: BranchPushRejection
  /** git's own words for the outcome (`non-fast-forward`, `pre-receive hook declined`, …). */
  reason: string
  /** Tracking was configured for this branch by this push. */
  upstreamSet: boolean
}

export interface PushBranchesResult {
  remote: string
  atomic: boolean
  results: BranchPushResult[]
  /** `remote:` lines the server sent — where a hosting service explains a
   *  protected-branch refusal. */
  remoteMessages: string[]
}

/**
 * One local branch the cleanup dialog may offer for deletion. The current
 * branch, branches checked out in a worktree, the default branch and protected
 * branches never appear here — they are listed in `excluded` instead.
 */
export interface BranchCleanupCandidate {
  name: string
  sha: string
  /** The configured upstream, short form (`origin/feature`), or null. */
  upstream: string | null
  /** The upstream is configured but its remote-tracking ref is gone (`[gone]`). */
  gone: boolean
  /** Reachable from the default branch (remote-tracking, or local when that is all there is). */
  merged: boolean
  /** The copy of the default branch that contains it (`origin/main`, or `main` when only the
   *  local one does — a merge made here and not pushed yet). Null when not merged. */
  mergedInto: string | null
  /** The tip is exactly the default branch's tip: a branch nobody committed on yet. */
  atMainTip: boolean
  /** Committer date of the tip, epoch milliseconds. */
  lastCommitAt: number
  /** Commits reachable from this branch and from no remote-tracking ref and not from the default branch. */
  uniqueCommits: number
  /** `uniqueCommits` stopped counting at the cap: the real number is at least this. */
  uniqueCapped: boolean
}

/** Why a local branch is never offered for cleanup. */
export type BranchCleanupExclusion = 'current' | 'worktree' | 'rebasing' | 'default' | 'protected'

export interface BranchCleanupScan {
  /** The default branch's name (`main`), or null when none could be found. */
  mainBranch: string | null
  /** What "merged" was measured against: `origin/main`, or `main` without a remote copy. */
  mainRef: string | null
  /** Every ref "merged" was measured against, full names, the remote copy first. */
  mainRefs: string[]
  candidates: BranchCleanupCandidate[]
  excluded: { name: string; reason: BranchCleanupExclusion }[]
  /** When the repository last fetched (FETCH_HEAD's mtime), or null. */
  lastFetchAt: number | null
}

/** One branch the user chose to delete, with the tip the dialog showed. */
export interface BranchDeleteRequest {
  name: string
  /** The tip the dialog listed. A branch that moved since is refused, not deleted. */
  sha: string
  /**
   * How many commits that exist only on this branch the user explicitly accepted
   * losing — the count the confirm showed. A branch with more is refused.
   */
  acceptedUnique: number
  /** Deleted because its content was found squash-merged: the main process checks that again. */
  squashMerged?: boolean
}

/** Why the main process refused to delete a requested branch. */
export type BranchDeleteRefusal = 'missing' | 'moved' | 'unique' | 'squashChanged' | BranchCleanupExclusion

/** A gone branch whose whole content is already in the default branch — a squash merge. */
export interface BranchSquashCheck {
  name: string
  /** The default-branch ref whose tree already holds the branch's changes, or null. */
  squashedInto: string | null
}

export interface BranchDeleteResult {
  name: string
  sha: string
  status: 'deleted' | 'refused' | 'failed'
  refusal?: BranchDeleteRefusal
  /** git's message when `status` is `failed`. */
  error?: string
  /** `branch.<name>.remote` as it was before the delete, for the undo. */
  upstreamRemote?: string
  /** `branch.<name>.merge` as it was before the delete, for the undo. */
  upstreamMerge?: string
}

/** What the undo of a cleanup recreates: the branch at its sha, and its tracking config. */
export interface BranchRestoreRequest {
  name: string
  sha: string
  upstreamRemote?: string
  upstreamMerge?: string
}

export interface BranchRestoreResult {
  name: string
  /**
   * `exists`: the name is back at the same commit, nothing to do. `restoredAs`:
   * the name was taken by another commit, so the branch came back under a new name.
   */
  status: 'restored' | 'restoredAs' | 'exists' | 'failed'
  /** The name it was recreated under when `status` is `restoredAs`. */
  restoredAs?: string
  error?: string
}

/**
 * A directory in this repository whose contents came from another repository via
 * `git subtree`. Unlike a submodule there is no `.gitmodules` to read: git
 * records only a `git-subtree-dir:` trailer on the commit that did the import,
 * so the url and ref are remembered by GitHuttBr unless the user supplies them.
 */
export interface SubtreeInfo {
  /** Directory inside this repo, e.g. `vendor/parser`. */
  prefix: string
  /** Source repository, when known. */
  url: string
  /** Branch or tag pulled from, when known. */
  ref: string
  /** True when the prefix still exists in the working tree. */
  present: boolean
  /** Sha of the upstream commit last imported, from the subtree trailer. */
  lastSplit: string
}

/** One `refs/replace/*` entry: git shows the replacement wherever the original is asked for. */
export interface ReplaceRef {
  original: string
  originalSubject: string
  replacement: string
  replacementSubject: string
  /** Parents of the replacement commit — a graft's whole point is changing these. */
  replacementParents: string[]
}

/** The state of object replacement in a repository. */
export interface ReplaceStatus {
  refs: ReplaceRef[]
  /** `core.useReplaceRefs` — false means git ignores every replacement here. */
  enabled: boolean
}

/** One configured `credential.helper`, and whether it can actually run. */
export interface CredentialHelperInfo {
  /** The value as git stores it: `osxkeychain`, `store`, `!gh auth git-credential`… */
  value: string
  scope: 'system' | 'global' | 'repo'
  /** True when the helper program exists — a typo here is invisible until a push fails. */
  available: boolean
  /** The `store` helper: passwords in a plain file, readable by anything you run. */
  plaintext: boolean
}

/** A `credential.<url>.*` section: rules that apply to one host or repository. */
export interface CredentialUrlRule {
  url: string
  helper: string
  username: string
  scope: 'system' | 'global' | 'repo'
}

/** A helper this platform could use, and whether it is installed. */
export interface CredentialCandidate {
  name: string
  available: boolean
  /** True for the one that fits this OS best. */
  recommended: boolean
}

/** Everything about how git will answer the next password prompt. */
export interface CredentialStatus {
  helpers: CredentialHelperInfo[]
  urlRules: CredentialUrlRule[]
  candidates: CredentialCandidate[]
  /** `~/.git-credentials`, counted and never read out — it holds live passwords. */
  plaintextFile: { path: string; exists: boolean; entries: number }
  /** Hosts this repository would ask about: its `https://` remotes. */
  httpsHosts: string[]
}

/** One `.gitattributes` file found in the repository, with its raw text. */
export interface AttributeFile {
  /** Repo-relative path, or `.git/info/attributes` for the private one. */
  path: string
  content: string
  /** True for `.git/info/attributes`: local-only, never committed, never shared. */
  local: boolean
}

/** What git says actually applies to a path, after every file has had its say. */
export interface AttributeCheck {
  path: string
  /** Attribute name → value: `set`, `unset`, `unspecified`, or a string. */
  attrs: Record<string, string>
}

/** A configured `diff.<name>` driver, and whether its converter really exists. */
export interface DiffDriverInfo {
  name: string
  /** The `textconv` command, which turns a binary into text git can diff. */
  textconv: string
  /** True when the first word of the command is on PATH. */
  available: boolean
  /** Where the setting lives, so the UI can say what it would change. */
  scope: 'repo' | 'global'
  /** True when the converter sits inside an AppImage's per-launch /tmp mount:
   *  stale once that app quits, and recreatable by any other local user. */
  ephemeral?: boolean
  /** True when the converter is this app's own pre-4.39 converter and could not be
   *  repointed (an AppImage, or an unwritable config): every diff through it fails
   *  unless the old install's directory is still there. */
  stale?: boolean
}

/** A pre-4.39 `diff.<name>.textconv` the app repointed at its current converter. */
export interface DiffDriverRepoint {
  name: string
  /** The value before, so the change can be undone. */
  previous: string
  next: string
  scope: 'repo' | 'global'
}

/** A converter GitHuttBr knows how to wire up, if it is installed. */
export interface DiffDriverSuggestion {
  /** Driver name, used as `diff=<name>` in .gitattributes. */
  name: string
  /** File patterns it is for, e.g. `*.docx`. */
  patterns: string[]
  /** The textconv command line. */
  textconv: string
  /** The binary it needs ('' when GitHuttBr ships the converter itself). */
  binary: string
  /** True when the converter is the one GitHuttBr ships — nothing to install. */
  bundled?: boolean
  available: boolean
  /** Why a bundled converter is offered but not available: 'appimage' — its
   *  path only exists while this AppImage runs. */
  unavailableReason?: 'appimage'
}

/** A configured `filter.<name>` clean/smudge driver. */
export interface FilterDriverInfo {
  name: string
  /** Command run on staging (working tree → repository). '' when unset. */
  clean: string
  /** Command run on checkout (repository → working tree). '' when unset. */
  smudge: string
  /** With `required`, a failing filter aborts the operation instead of passing bytes through. */
  required: boolean
  scope: 'repo' | 'global'
  cleanAvailable: boolean
  smudgeAvailable: boolean
}

/** One file's outcome in a filter dry run. */
export interface FilterDryRunFile {
  file: string
  /** The clean command ran and exited 0. */
  ok: boolean
  error?: string
  /** Whether smudge(clean(file)) reproduced the original bytes. */
  roundtrip: 'ok' | 'different' | 'skipped'
  /** The first bytes of the cleaned output, so the user sees what git would store. */
  preview: string
}

/** A filter dry run: how many files the pattern matches, and what happened to the sample. */
export interface FilterDryRunResult {
  matched: number
  tested: FilterDryRunFile[]
}

/** What `filter.<name>` held before setFilterDriver overwrote it — the undo payload. */
export interface FilterDriverPrevious {
  clean: string
  smudge: string
  required: boolean
}

/** The four kinds of thing git stores. Everything else is built from these. */
export type GitObjectKind = 'commit' | 'tree' | 'blob' | 'tag'

/** One entry of a tree object, as `git ls-tree -l` prints it. */
export interface TreeChild {
  /** Six-digit mode: 100644 file, 100755 executable, 040000 tree, 120000 symlink, 160000 gitlink. */
  mode: string
  kind: GitObjectKind
  sha: string
  name: string
  /** Blob size in bytes; null for trees and submodule gitlinks. */
  size: number | null
  /** For a subtree: how many entries it holds, so a row can say "4 items" without opening it. */
  count?: number
  /** For a symlink (mode 120000): the path it points at, which is all its blob contains. */
  target?: string
}

/** A raw object from the database, decoded enough to be walkable. */
export interface GitObject {
  sha: string
  kind: GitObjectKind
  /** Size of the object's content, as `git cat-file -s` reports it. */
  size: number
  /** What the caller asked for, e.g. `HEAD`, `main^{tree}`, a path. */
  rev: string
  commit?: {
    tree: string
    /** How many entries the root tree holds. */
    treeCount: number
    parents: string[]
    /** Each parent's subject line, in the order of `parents`. */
    parentSubjects: string[]
    author: string
    committer: string
    message: string
  }
  tag?: {
    object: string
    type: string
    name: string
    tagger: string
    message: string
    /** The subject of the tagged object when it is a commit, else ''. */
    targetSubject: string
  }
  tree?: TreeChild[]
  blob?: {
    /** Decoded text, or null when the blob is binary. */
    text: string | null
    /** True when only the head of the blob is here. */
    truncated: boolean
  }
}

/** A ref and what it points at, for the object explorer's starting points. */
export interface RefObject {
  /** Full ref name, e.g. `refs/heads/main`, or `HEAD`. */
  name: string
  sha: string
  /** The kind of object the ref names — annotated tags point at a `tag`. */
  kind: GitObjectKind
  /** For `HEAD` on a branch: the branch it is a symbolic ref to, short (`main`). */
  symbolic?: string
}

/**
 * The switches that turn a painful merge into a routine one.
 *
 * Everything here maps to a documented `git merge` flag; nothing is invented.
 * The defaults (all absent) are a plain merge, which is what every existing
 * caller gets.
 */
export interface MergeOptions {
  /** `--no-ff` — always record a merge commit, even when a fast-forward would do. */
  noFf?: boolean
  /** `--ff-only` — refuse anything that is not a fast-forward. */
  ffOnly?: boolean
  /** `--squash` — take the changes, leave the history and the commit to you. */
  squash?: boolean
  /** `--no-commit` — merge and stage, but stop before committing. */
  noCommit?: boolean
  /** `-s <strategy>` — `subtree` is the one people actually need. */
  strategy?: 'ort' | 'resolve' | 'subtree' | 'octopus'
  /** `-X ours` / `-X theirs` — resolve *conflicting hunks* one way automatically. */
  favour?: 'ours' | 'theirs'
  /** `-X ignore-space-change` and friends — whitespace-only clashes stop being clashes. */
  ignoreSpace?: 'change' | 'all' | 'eol'
}

/** A commit from one side of the merge that touched the conflicted file. */
export interface ConflictCommit {
  sha: string
  subject: string
  author: string
  /** ISO date. */
  date: string
  /** Which side of the merge it came from. */
  side: 'ours' | 'theirs'
}

/**
 * What a repository is spending disk on, and what maintenance could reclaim.
 * Everything here comes from `git count-objects -v` plus a reachability walk;
 * nothing is estimated.
 */
export interface MaintenanceStats {
  /** Objects sitting on their own, one file each — how git writes them first. */
  looseObjects: number
  looseBytes: number
  /** Objects inside packfiles, where they are compressed and deltified. */
  packedObjects: number
  packs: number
  packBytes: number
  /** Loose objects already inside a pack: pure duplication until gc runs. */
  prunePackable: number
  /** Files git does not recognise under .git/objects — leftovers from a crash. */
  garbageFiles: number
  garbageBytes: number
  /** Unreachable loose objects `git prune` would drop. */
  prunable: number
  prunableBytes: number
  /** Everything under .git, which is the number people actually notice. */
  gitBytes: number
  /** When the newest packfile was written — the last time gc did real work. */
  lastPack: string | null
  /** True when `git maintenance` has this repository registered. */
  scheduled: boolean
  /** Whatever git left in .git/gc.log — an automatic gc that gave up. */
  gcLog: string
}

/** The maintenance jobs GitHuttBr will run, in the order they cost. */
export type MaintenanceTask = 'gc' | 'aggressive' | 'commitGraph' | 'prune'

/** Size on disk before and after a maintenance run. */
export interface MaintenanceResult {
  before: number
  after: number
  /** git's own output, so a refusal is readable rather than silent. */
  output: string
}

/** `git fsck` — is the object database internally consistent? */
export interface FsckReport {
  ok: boolean
  /** Objects nothing points at. Normal after a rebase; not damage. */
  dangling: number
  /** Objects something points at and git cannot find. This is damage. */
  missing: number
  output: string
}

/** What a bundle should hold: everything, one ref, or the commits in a range. */
export type BundleScope =
  | { kind: 'all' }
  | { kind: 'ref'; ref: string }
  | { kind: 'range'; from: string; to: string }

/** A written bundle file. */
export interface BundleResult {
  path: string
  bytes: number
  /** Refs the bundle carries — 0 would mean git wrote an empty one. */
  refs: number
}

/** One ref inside a bundle, as `git bundle list-heads` prints it. */
export interface BundleRef {
  /** Full ref name, e.g. `refs/heads/main`. */
  name: string
  sha: string
}

/** What a bundle file holds, and whether this repository can unbundle it. */
export interface BundleInfo {
  refs: BundleRef[]
  /** Commits the bundle expects the receiving repository to already have. A
   *  range bundle is worthless without them; a full one lists none. */
  prerequisites: string[]
  /** True when every prerequisite is present here. */
  usable: boolean
  /** git's own verify output — the explanation when `usable` is false. */
  message: string
}

export type ArchiveFormat = 'zip' | 'tar.gz' | 'tar'

/** A written archive file. */
export interface ArchiveResult {
  path: string
  bytes: number
}

/**
 * One removable path in a `git clean` preview — a file or a wholly untracked
 * directory, exactly as `git ls-files --others --directory` collapses it.
 */
export interface CleanEntry {
  /** Repo-relative path; a directory keeps git's trailing slash. */
  path: string
  kind: 'file' | 'dir'
  /** Matched by .gitignore. Never selected by default: usually build output,
   *  sometimes the only copy of a local .env. */
  ignored: boolean
  /** Bytes on disk — a directory is the sum of what it holds. */
  bytes: number
  /** A directory with its own .git. `git clean` refuses these; the trash does not. */
  nested: boolean
}

/** What removing untracked files would take away, before agreeing to it. */
export interface CleanPreview {
  entries: CleanEntry[]
  /** True when the scan hit its entry cap and the list is partial. */
  truncated: boolean
}

/** What a clean actually removed. */
export interface CleanResult {
  removed: number
  bytes: number
  /** True when the paths went to the OS trash rather than being deleted. */
  trashed: boolean
}

/** Whether git is memorising conflict resolutions, and how many it holds. */
export interface RerereStatus {
  /** `rerere.enabled` — resolutions are recorded and replayed. */
  enabled: boolean
  /** `rerere.autoUpdate` — a replayed resolution is staged, not just written. */
  autoUpdate: boolean
  /** True when the setting comes from this repository rather than global config. */
  perRepo: boolean
  /** Resolutions currently memorised, i.e. entries in `.git/rr-cache`. */
  recorded: number
  /** Files in the current conflict that git resolved from memory. */
  replayed: string[]
}

/** One entry from `git reflog` — the recovery net for lost/rewound commits. */
export interface ReflogEntry {
  sha: string
  selector: string // e.g. "HEAD@{0}"
  action: string // full reflog subject, e.g. "commit: …" or "reset: moving to HEAD~1"
  date: number // unix seconds
}

/** Snapshot of an in-progress (or just-finished) `git bisect` session. */
export interface BisectStatus {
  inProgress: boolean
  needGood: boolean // still needs an initial good commit before narrowing starts
  needBad: boolean // still needs an initial bad commit
  currentSha: string // commit to test now (HEAD); '' when finished or not started
  currentSubject: string
  remainingSteps: number // git's "roughly N steps" estimate; -1 when unknown
  finished: boolean // the first bad commit has been identified
  firstBadSha: string
  firstBadSubject: string
}

export interface Profile {
  id: string
  name: string
  gitName: string
  gitEmail: string
  githubToken: string
  /** GitHub Enterprise Servers this profile is connected to, each with its own
   *  token. `githubToken` stays github.com's and is never sent to one of these. */
  githubEnterprise?: GithubEnterpriseHost[]
  azureToken: string
  /** Azure DevOps organization, used to validate the PAT and scope repo/PR lookups. */
  azureOrg?: string
  /** gitlab.com's token. Never sent to a self-managed server — those keep their
   *  own, in `gitlabServers`. */
  gitlabToken: string
  /** Which instance issued `gitlabToken`. Absent or gitlab.com is valid; anything
   *  else is a leftover from the one-instance model and is never sent. */
  gitlabTokenIssuer?: string
  forgejoTokenIssuer?: string
  /** Self-managed GitLab servers this profile is connected to, each with its own
   *  token. `gitlabToken` stays gitlab.com's and is never sent to one of these. */
  gitlabServers?: GitlabServer[]
  /** Legacy: the single self-managed GitLab of profiles written before
   *  `gitlabServers`. Read only to migrate (`migrateGitlabProfile`), never written. */
  gitlabUrl?: string
  bitbucketToken: string
  /** Bitbucket Data Center servers this profile is connected to, each with its
   *  own HTTP access token. `bitbucketToken` stays bitbucket.org's and is never
   *  sent to one of these. */
  bitbucketServers?: BitbucketServerHost[]
  /** Forgejo (or Gitea) access token, for the instance at `forgejoUrl`. Optional:
   *  settings written before Forgejo support have no such field. */
  forgejoToken?: string
  /** The Forgejo instance this profile's token belongs to (`https://git.example.org`,
   *  or codeberg.org). There is no default: empty means no Forgejo. */
  forgejoUrl?: string
  /** Accounts this profile signed in with from a login already on the machine —
   *  git's credential helper or the GitHub CLI — one per provider. Without one
   *  (and without a token) the profile is not connected: a machine-wide login is
   *  never borrowed implicitly, so two profiles can hold two accounts. */
  links?: Partial<Record<RepoHost, AccountLink>>
  /** Where the profile's picture comes from. Absent means `auto`. */
  avatar?: ProfileAvatar
  /** "Not now" on the suggestion to use a repository's icon as the avatar. */
  avatarRepoHintDismissed?: boolean
  /**
   * Whether this profile has its own AI instead of the general one
   * (`AppSettings.ai`). Absent or false: the general AI, engine and behaviour
   * alike, and `ai` here is not read. True: `ai` is the whole config this
   * profile runs with — see `shared/aiScope.ts`.
   */
  ownAI?: boolean
  ai: AIConfig
}

/** One GitHub Enterprise Server of a profile. The token is a secret: on disk it
 *  lives in the keychain-encrypted store, filed under the server's base URL. */
export interface GithubEnterpriseHost {
  /** The server's address, `https://host[:port]` (see `normalizeGithubEnterpriseUrl`). */
  url: string
  token: string
}

/** One self-managed GitLab of a profile. Like a GHES token, the token lives in
 *  the keychain-encrypted store on disk, filed under the server's base URL. */
export interface GitlabServer {
  /** The server's base, `https://host[:port][/path]` (see `normalizeGitlabServerUrl`). */
  url: string
  token: string
  /** A login on this machine the profile used for this server — only ever
   *  carried over from a one-instance profile. Not a secret. */
  link?: AccountLink
}

/** One Bitbucket Data Center of a profile. The token is a secret: on disk it
 *  lives in the keychain-encrypted store, filed under the server's base URL. */
export interface BitbucketServerHost {
  /** `https://host[:port][/context]` (see `normalizeBitbucketServerUrl`). */
  url: string
  token: string
  /** The account name git sends with a personal token; empty for a project or
   *  repository token, which git sends as `x-token-auth`. Not a secret. */
  username?: string
  /**
   * Whose token this is. A personal token goes with its owner's name — this
   * entry's `username`, else the one in the remote URL; a project or repository
   * token always with `x-token-auth`, which Basic auth requires for it. Absent
   * (not set — the default, never inferred): `username`, else the remote URL's,
   * else `x-token-auth`, as before the choice existed.
   */
  tokenKind?: BitbucketServerTokenKind
}

/** A Data Center HTTP access token's owner: one user, or a project or repository. */
export type BitbucketServerTokenKind = 'personal' | 'project'

/**
 * The picture a profile shows in the title bar and the profile list. Only the
 * choice lives in settings; an `image` is a file in the user-data folder, keyed
 * by profile id (main/profileAvatar.ts). Commits never carry it — see
 * `noreplyEmail` for what makes a hosting site show a picture on a commit.
 */
export type ProfileAvatar =
  /** Gravatar for the git email, else a generated face (the default). */
  | { source: 'auto' }
  /** The connected account's picture, remembered as the URL the host gave. */
  | { source: 'account'; accountHost: 'github' | 'gitlab'; accountUrl: string }
  /** A glyph from PROFILE_AVATAR_ICONS on a colour from PROFILE_AVATAR_COLORS. */
  | { source: 'icon'; icon: string; color: string }
  /** An image the user chose, stored on this computer. */
  | { source: 'image' }
  /** An image picked from one of the profile's repositories, copied into the
   *  same store as `image` — the repository can move or go without the picture
   *  going with it. `repo` and `file` only say where it came from. */
  | { source: 'repo'; repo: string; file: string }

/** Which machine login a profile uses for a provider. `login` is the gh account,
 *  or the username git's credential helper filed the credential under. Not a secret. */
export interface AccountLink {
  source: 'git' | 'gh'
  login: string
}

export interface RepoRef {
  path: string
  name: string
  /** Absolute path of the main worktree when this repo is a linked worktree.
   *  Display metadata: group chips collapse `root · branch` to the leaf label
   *  when siblings share a root. Absent for ordinary repos and roots. */
  worktreeRoot?: string
}

/** Fields shared by every tab regardless of kind. */
interface TabBase {
  id: string
  name: string
  color?: string
}

/** A standalone single-repository tab. */
export interface RepoTab extends TabBase {
  kind: 'repo'
  repos: RepoRef[]
  activeRepoPath: string | null
  /**
   * Repo-scoped pages opened *inside* this tab — DevTools, the wiki, insights.
   * They ride on the tab as small icons instead of claiming a tab of their own:
   * they belong to this repository and are meaningless without it.
   */
  pages?: PageContent[]
  /** Index into `pages` that is showing, or null for the repository itself. */
  activePage?: number | null
}

/** A folder inside a group tab. Holds repositories (by path, referencing the
 *  group's flat `repos` list) and further folders, nested to any depth.
 *  Purely an organisation layer: membership, status and batch actions all keep
 *  reading the group's flat `repos`, so a repo filed into a folder is still an
 *  ordinary member of the group. */
export interface RepoFolder {
  id: string
  name: string
  color?: string
  collapsed?: boolean
  /** Repos held directly by this folder, in display order. */
  paths: string[]
  /** Nested folders, in display order. */
  folders: RepoFolder[]
}

/** One repository GitHuttBr knows about, whether or not it is open. The registry
 *  file is a cache: lose it and a rescan rebuilds it. */
export interface RegistryRepo {
  /** Canonical absolute path — the identity, and the key used everywhere else. */
  path: string
  /** Folder name at index time. `repoAliases` still wins for display. */
  name: string
  /** First path segment of the remote's namespace. Null with no remote. */
  owner: string | null
  /** Branch as of the last index, read from .git/HEAD. Null when detached. */
  branch: string | null
  /** How it got here — a scanned repo the user has never opened still lists. */
  source: 'opened' | 'scanned'
  /** Unix seconds. Drives the Recent section, which is therefore not capped. */
  lastOpenedAt: number
  /** Folder absent at the last existence check. Stored rather than computed:
   *  stat-ing 200 paths belongs on page load, never in a render. */
  missing: boolean
  /** The scan folders, as configured, whose last scan found this repository.
   *  Not derivable from `path`: a repository reached through a link inside a
   *  folder is stored by its real path, which can sit anywhere on disk.
   *  Absent until a scan finds it. */
  foundUnder?: string[]
}

/** A folder GitHuttBr scans for repositories. A preference, not an index. */
export interface RepoScanRoot {
  path: string
  /** How deep to descend. 3 covers ~/Code/<client>/<repo>; deeper gets slow
   *  fast, and a repo nested further is almost always vendored. */
  depth: number
}

/** What a scan produced. Both counts are taken where the merge happens, because
 *  a caller cannot reconstruct them from the registry it is handed. `found` is
 *  every repository under the roots; `added` only the ones not indexed before —
 *  reporting `added` alone reads as "found nothing" on a second scan. */
export interface RepoScanResult {
  repos: RegistryRepo[]
  found: number
  added: number
}

/** A collection of repositories shown under one collapsible chip. Repos not
 *  claimed by any folder in `folders` render at the group root. */
export interface GroupTab extends TabBase {
  kind: 'group'
  repos: RepoRef[]
  folders?: RepoFolder[]
  activeRepoPath: string | null
  collapsed?: boolean
  /** Same as `RepoTab.pages`: repo-scoped pages opened inside this tab. They
   *  are drawn on the chip of the repository they belong to, and only while
   *  that repository is the selected one. */
  pages?: PageContent[]
  activePage?: number | null
}

/** A non-repository "page" tab (changelog today; docs/others later).
 *  The discriminant lives on `page.type` so new page kinds slot in here
 *  without touching repo/group plumbing. */
export interface PageTab extends TabBase {
  kind: 'page'
  page: PageContent
  /**
   * The user renamed this tab, so `name` wins over the derived label.
   * Without it the label is translated at render time — otherwise a tab opened
   * in English would keep reading "Vault" after switching to Spanish.
   */
  renamed?: boolean
}

export type PageContent =
  | { type: 'changelog' }
  | { type: 'logs' }
  | { type: 'notifications' }
  | { type: 'insights'; repoPath: string }
  | { type: 'wiki'; repoPath: string }
  | { type: 'ci-runs'; repoPath: string }
  | { type: 'vault' }
  | { type: 'repositories' }
  | { type: 'help'; page?: string }
  | { type: 'licenses' }
  // Flutter DevTools, embedded. `url` is the address at the time the tab was
  // opened; while the session lives, the live one from the store wins, so a
  // hot restart's new address follows without reopening the tab.
  | { type: 'devtools'; repoPath: string; launchId: number; url: string; label: string; tool: string }
  | { type: 'release'; release: ReleaseInfo; repoPath: string }
  | { type: 'issue'; issue: IssueInfo; repoPath: string; remoteUrl: string }
  | { type: 'milestone'; milestone: MilestoneInfo; repoPath: string; remoteUrl: string }
  // `title` is what the list knew when it was opened — the tab's label until the
  // page has loaded the real one.
  // `via: 'list'` — opened from the pull requests page, so its ‹ › walk the
  // filtered list it came from rather than the repository's open PRs.
  // `listFrom: 'mission'` — that list was opened from Mission Control: its
  // "← Pull requests" takes the flag back, so the list keeps its way back there.
  | { type: 'pr'; repoPath: string; remoteUrl: string; number: number; title: string; via?: 'list'
      listFrom?: 'mission' }
  // `from: 'mission'` — opened from Mission Control, so the page offers the way back.
  | { type: 'pull-requests'; repoPath: string; from?: 'mission' }

/** One dependency's licence, collected at build time by scripts/gen-licenses.mjs.
 *  `text` is null when the package ships an SPDX id but no licence file. */
export interface DependencyLicense {
  name: string
  version: string
  license: string
  homepage: string | null
  text: string | null
}

/** A published GitHub release, as surfaced to the changelog page. */
export interface AppRelease {
  tag: string
  name: string | null
  body: string | null
  publishedAt: string
  url: string
  prerelease: boolean
}

/** Lifecycle of an in-app update, mirrored from electron-updater into the UI. */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

/** The update that is available / downloaded. */
export interface UpdateInfo {
  version: string
  notes: string | null
  releaseDate?: string
  /** GitHub release page, used as the manual-download fallback. */
  url?: string
}

export interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export interface UpdateState {
  status: UpdateStatus
  info: UpdateInfo | null
  progress: UpdateProgress | null
  error: string | null
  /** Version already downloaded and staged on disk, if any. Survives a later
   *  check finding something newer — that is what lets the UI say "restart
   *  installs v1, but v2 is out" instead of silently installing the old one. */
  staged: string | null
  /** False in dev / unpackaged builds where electron-updater can't install.
   *  The renderer still surfaces "new version available" and falls back to
   *  opening the release page for the download. */
  supported: boolean
}

export type TabState = RepoTab | GroupTab | PageTab

/** Tabs that carry repositories (everything except page tabs). */
export type RepoBearingTab = RepoTab | GroupTab

/** Repos for any tab — empty for page tabs. Lets callers iterate tabs
 *  without narrowing the union by hand. */
export function tabRepos(tab: TabState): RepoRef[] {
  return tab.kind === 'page' ? [] : tab.repos
}

/** Active repo path for any tab — null for page tabs. */
export function tabActiveRepoPath(tab: TabState): string | null {
  return tab.kind === 'page' ? null : tab.activeRepoPath
}

/** A named saved tab layout. The active workspace mirrors the live
 *  `tabs`/`activeTabId`; switching swaps the whole tab strip in one move so
 *  users can keep separate sets (e.g. "work" vs "personal") without juggling
 *  every tab by hand. */
export interface Workspace {
  id: string
  name: string
  tabs: TabState[]
  activeTabId: string | null
  /** Folder a scan generated this workspace from. Survives a rename so the
   *  next scan merges instead of creating a duplicate. Absent on hand-made
   *  workspaces, which match by name instead. */
  sourcePath?: string
}

export type TabRepoLabel = 'both' | 'name' | 'image'

/**
 * What `settings:get` and `settings:unlock` answer: the settings, and the
 * generation of credentials the renderer was just handed. A save names the
 * generation its state was built from; a blank token is a clear only when that
 * is still the current one for the window (see main/settings.ts).
 */
export interface SettingsReply {
  settings: AppSettings
  generation: number
}

/** How a settings save treats the credentials it carries. */
export interface SettingsSaveOptions {
  /**
   * An imported file. `merge` (the default for an import) only adds or replaces
   * credentials — a blank never clears one; `replace` makes the saved
   * credentials exactly the file's, and only counts when the file carries some.
   */
  import?: 'merge' | 'replace'
}

/** The encrypted token store, as Settings → Security reports it. */
export interface SecretsState {
  /** A store exists that this session could not decrypt: it is left untouched. */
  unreadable: boolean
}

export interface AppSettings {
  profiles: Profile[]
  activeProfileId: string
  /** Per-repository profile binding, keyed by repo path. When a repo with a
   *  binding becomes the active repo, its profile is auto-activated. Path-keyed
   *  (not stored on RepoRef) so the same repo across tabs/groups can't diverge. */
  repoProfiles: Record<string, string>
  /**
   * Display aliases keyed by canonical repository path. An alias changes only
   * the name GitHuttBr shows — it never renames or moves the directory on disk.
   * Path-keyed (not stored on RepoRef) so the same repo across tabs, groups and
   * workspaces cannot diverge.
   */
  repoAliases: Record<string, string>
  /** Tab images keyed by canonical repository path; each value is a path
   *  relative to that repository's root. Relative so the picture follows the
   *  repository's own files rather than a location on this machine. */
  repoImages?: Record<string, string>
  /** What a repository tab shows. A repository without a loadable image always
   *  shows its name, whatever this says. Absent means `both`. */
  tabRepoLabel?: TabRepoLabel
  tabs: TabState[]
  activeTabId: string | null
  /** Saved tab layouts. Always has at least one ("Default"); the active one's
   *  tabs are kept in sync with the live `tabs`/`activeTabId` above. */
  workspaces: Workspace[]
  activeWorkspaceId: string
  recentRepos: RepoRef[]
  /** Folders scanned for repositories by the Repositories page. */
  repoScanRoots: RepoScanRoot[]
  /** Starred repositories, by canonical path. Path-keyed for the same reason
   *  `repoAliases` is: the same folder in two tabs must not diverge. */
  favouriteRepos: string[]
  /** Section tints on the Repositories page, keyed by that page's section key
   *  (`open`, `favourites`, `recent`, `all`, `workspace:<id>`). Page-local: a
   *  colour here says nothing about the workspace it may name. */
  repoSectionColors: Record<string, string>
  /** How a multi-repo pull reconciles when the user has not said otherwise. */
  pullMode: 'default' | 'ff-only' | 'rebase'
  appThemeId: string
  codeThemeId: string
  themeMode: ThemeMode
  codeFontSize: number
  iconColors: IconColorMode
  iconPalette: IconPalette
  customAppThemes: AppTheme[]
  customCodeThemes: CodeTheme[]
  language: Language
  initialCommitCount: number
  loadMoreCount: number
  autoLoadOnScroll: boolean
  relativeDates: boolean
  commitAvatars: boolean
  /** GitHub profile pictures after Gravatar (docs/help/avatars.md). Off by
   *  `commitAvatars` too; without a token only noreply addresses are mapped. */
  githubAvatars: boolean
  /** Idle motion on the title-bar profile avatar. The pose it holds still
   *  follows the working tree either way; this only stops it moving. */
  avatarMotion: boolean
  fileListView: 'path' | 'tree'
  /** Group local branches into collapsible folders by their `/`-separated
   *  prefix (feature/*, release/*, …). A prefix with a single branch stays flat. */
  groupBranches: boolean
  graphColumns: GraphColumns
  graphColumnOrder: GraphFlowColumnId[]
  /** Visual style of the commit graph (palette, line corners, density, width). */
  graphStyle: GraphStyle
  /** User-defined graph palettes, shown alongside the built-in ones. */
  customGraphPalettes: GraphPalette[]
  /** Per-repository layout overrides (graph columns + sidebar sections), keyed
   *  by repo path. A repo with no entry inherits the global defaults. */
  repoLayouts: Record<string, RepoLayout>
  /** Per-repository todo lists, keyed by canonical repo path. Absent for a
   *  repository nobody has written a todo for. */
  repoTodos?: Record<string, RepoTodo[]>
  /** Bookmarked places in the code, per repository. */
  repoBookmarks?: Record<string, RepoBookmark[]>
  /**
   * When each pull request page was last left, in ms since the epoch, keyed by
   * remote identity + number (lib/prVisits.ts) — what "new since your last
   * visit" counts from. Capped to the most recent pull requests.
   */
  prVisits?: Record<string, number>
  /**
   * When the Problems dock is allowed to run the project's analyzers. They are
   * the repository's own toolchain — `tsc`, `eslint`, `cargo clippy` — so this
   * is about how much of your machine GitHuttBr may spend without being asked.
   *
   * `onOpen` sweeps when the dock is opened with nothing to show (the default),
   * `manual` only ever sweeps on the refresh button, and `off` hides the
   * analyzer half of the dock altogether.
   */
  analyzerMode?: AnalyzerMode
  /** Hide ticked todos in the sidebar section and the todo list. The entries
   *  are kept — only the display drops them. */
  todosHideDone: boolean
  /** Order todos by hand — the list keeps the order the user dragged or
   *  arrowed it into, instead of sorting by priority then age. Flipped on by
   *  the first reorder, so nobody has to find the switch first. */
  todosManualOrder?: boolean
  autoFetchMinutes: number
  /** How often Mission Control re-reads the repositories while it is on screen,
   *  in seconds; never below 30. It does not run while the page is closed. */
  missionRefreshSeconds?: number
  /** Pull request Files tab: "Next unviewed" marks the open file viewed before moving on. */
  prMarkViewedOnNext?: boolean
  /** How Mission Control colours "N commits since the tag", by range. */
  missionReleaseTiers?: ReleaseNoteTiers
  /** Raise an OS notification for new review-requested / CI inbox items. */
  desktopNotifications?: boolean
  confirmForcePush: boolean
  /** Force a merge commit even when a fast-forward is possible. */
  mergeCommit: boolean
  sidebarOrder: string[]
  /** Sidebar section ids the user has hidden via the visibility toggle. */
  sidebarHidden: string[]
  onboardingCompleted: boolean
  /**
   * Whether the one-time "AI settings moved to accounts" notice has been shown.
   * Set once the user dismisses it, so an upgrade explains itself exactly once.
   */
  aiAccountsNoticeSeen?: boolean
  /**
   * The general AI: the whole config — engine (accounts, keys, assignments) and
   * behaviour (styles, instructions, chat policy) — every profile uses unless it
   * has its own (`Profile.ownAI`). See `shared/aiScope.ts`.
   */
  ai: AIConfig
  /**
   * Set once the general AI carries the behaviour fields too. Builds before it
   * kept them on each profile; `ensureGeneralAI` copies one profile's into `ai`
   * exactly once, then sets this so a later read never copies them again.
   */
  aiBehaviourShared?: boolean
  /**
   * The profile whose keychain entry still holds the general AI's keys: set when
   * the general AI was first built from that profile, read by `applySecrets`
   * only while the general AI has no entry of its own. Dropped by the renderer
   * once an unlocked read has handed it the keys, so a key cleared later is
   * never brought back from there.
   */
  aiSecretsFrom?: string
  /** Auto-open the changelog page tab after the app updates to a new version. */
  autoOpenChangelog: boolean
  /** Minutes between automatic WIP snapshots (0 = off). */
  wipSnapshotMinutes: number
  /** Take a WIP snapshot automatically before destructive operations
   *  (discard, clean, hard reset, restore from commit). */
  snapshotGuard: boolean
  /** Local CI via `act` (optional integration; needs act + Docker installed). */
  localCiEnabled: boolean
  /** Run `codegraph init` on new worktrees when the parent repo is indexed (opt-in). */
  codegraphIndexWorktrees: boolean
  /** When a worktree opens while its root repo (or a sibling worktree of the
   *  same root) is already open, offer to group them into one tab (opt-in,
   *  toggled from the add-worktree dialog — same pattern as
   *  codegraphIndexWorktrees). */
  worktreeAutoGroup: boolean
  /** Inside a group tab, worktree chips drop the repeated `root · ` prefix and
   *  show only the branch leaf — the group name already carries the context. */
  worktreeShortLabels: boolean
  /** New worktrees get the source repo's gitignored files (.env, local
   *  overrides) copied across — generated dirs like node_modules are skipped. */
  worktreeCopyIgnored: boolean
  /** Mask secret values (KEY=••••) in .env/key files in the diff & file viewer. */
  maskSecrets: boolean
  /** Images in pull request and issue comments from a site other than the host's
   *  own load without a click. Off: each shows a placeholder until clicked, so a
   *  stranger's comment cannot learn this machine's IP and when it was read. */
  commentImagesFromOtherSites: boolean
  /** File view (working-tree files only): a colored bar next to lines changed
   *  since HEAD/the index, click to see the change. */
  showChangeGutter: boolean
  /** File view: a VS Code-style scaled overview of the whole file, floating
   *  at the right edge of the viewer. */
  showMinimap: boolean
  /** Surface a Run/Launch picker in the sidebar when a `.vscode/launch.json`
   *  exists. Off → the launch UI is hidden entirely. */
  enableLaunchJson: boolean
  /** Custom keyboard-shortcut overrides: shortcut id → combo (e.g. "mod+k"). */
  shortcuts: Record<string, string>
  /** Warn before committing files larger than this many KB (0 = off). */
  largeFileKb: number
  /** When to show a confirmation dialog before closing a repo tab, group, or
   *  repo-within-group. 'always' = every close; 'wip' = only when there are
   *  uncommitted changes or merge conflicts; 'never' = close silently. */
  warnOnClose: 'always' | 'wip' | 'never'
  /** Where the integrated terminal pane docks: full-width along the bottom,
   *  under the center graph column only (default — sidebars stay full height),
   *  or as its own right-hand column. A file that never stored the key gets the
   *  default. 4.40 moves a stored 'bottom' to 'center' once (see
   *  `terminalCenterApplied`); a later choice of 'bottom' or 'right' is kept. */
  terminalPlacement: 'bottom' | 'center' | 'right'
  /** Set once the 4.40 switch of the terminal to the center has run, so it
   *  never moves a placement the user picks afterwards. */
  terminalCenterApplied: boolean
  /** Open the integrated terminal the first time each repository becomes the
   *  active one in a session. Closing it is respected until the next launch. */
  openTerminalOnRepoOpen: boolean
  /** Integrated-terminal palette preset (`TERMINAL_THEMES` id) and font. */
  terminalThemeId: string
  terminalFontSize: number
  terminalFontFamily: string
  /** Shell spawned for new integrated-terminal sessions. Windows: a preset id
   *  ('powershell' | 'pwsh' | 'cmd' | 'gitbash' | 'wsl' | 'system') or a custom
   *  executable path; 'system' = COMSPEC (cmd.exe). macOS/Linux: '' / 'system'
   *  (and any Windows preset, since the stored default is 'powershell') = the
   *  system shell ($SHELL, else the account's), or an absolute path. Existing sessions keep the
   *  shell they were created with. */
  terminalShell: string
  /** Oh My Posh theme for new terminal sessions — a bare theme name (resolved
   *  under %POSH_THEMES_PATH%) or a full .omp.json path. Empty leaves the
   *  shell's own POSH_THEME/built-in default in charge. */
  terminalPoshTheme: string
  /** Header tab sizing: 'fixed' = tabs keep their content width and the strip
   *  scrolls on overflow (classic); 'fit' = tabs shrink equally toward a floor
   *  width like a browser, scrolling only past the floor. */
  tabSizing: 'fixed' | 'fit'
  /** Which side the branches/files sidebar docks on. */
  sidebarSide: 'left' | 'right'
  /** Let the right details panel span the full window height instead of
   *  stopping above a full-width bottom terminal. Only affects 'bottom'
   *  terminal placement. */
  rightPanelFullHeight: boolean
  /** Parent folder of the last clone, used to pre-fill the clone dialog. */
  lastClonePath?: string
  /** User-chosen external application (e.g. VS Code) used by the "Open with <App>"
   *  action on files, folders and repositories — analogous to running `code <path>`.
   *  Undefined until the user picks one via Settings → General or onboarding. */
  defaultOpenApp?: { name: string; path: string }
  /** External editor for the "Open in <editor>" actions on repositories, files
   *  and single lines. Undefined until the user picks one in Settings → General;
   *  the menu entries stay hidden until then. */
  editor?: EditorSetting
  /** Last app version the user has seen the changelog for. Undefined until the
   *  first run that records it; used to detect upgrades. */
  lastSeenVersion?: string
  /** Version the user chose to skip via "don't show again". The new-version
   *  banner stays hidden for exactly this version; a later one shows again. */
  skippedUpdateVersion?: string
  /** The settings format of the build that last wrote the file (see
   *  `shared/settingsFormat.ts`). Stamped by main on every save. */
  settingsFormat?: number
  /** The last time the user went back to an earlier version. Its `from` is never
   *  offered as an update again — only versions newer than it are. */
  versionRollback?: VersionRollback
}

/** A switch to an earlier version, recorded by the build that left and read by the one it lands on. */
export interface VersionRollback {
  /** The version left — never offered again. */
  from: string
  /** The version gone back to. */
  to: string
  /** ISO time of the switch. */
  at: string
  /** The settings backup taken just before (a file name in settings-backups/). */
  backup?: string
  /** Open the target's release notes once it starts. */
  showNotes?: boolean
  /** The "you went back" banner was closed. */
  noticeDismissed?: boolean
}

/** One settings copy kept in userData/settings-backups/. */
export interface SettingsBackup {
  /** The file name; also the id the restore and reveal calls take. */
  name: string
  /** The version that made it. */
  version: string
  /** The version the app was switching to. */
  target: string
  reason: 'rollback' | 'update' | 'restore'
  /** ISO time. */
  createdAt: string
}

/** A published version offered under Settings → About → Previous versions. */
export interface RollbackRelease {
  version: string
  publishedAt: string
  /** One line from the release notes, or empty. */
  summary: string
  url: string
}

export type RollbackReleasesReply =
  | { ok: true; releases: RollbackRelease[] }
  | { ok: false; reason: 'offline' | 'rate-limited' | 'failed' }

/** Whether this install can switch versions in place, and if not, why. */
export interface RollbackSupport {
  supported: boolean
  /** `dev`: an unpackaged run. `platform`: a package kind the updater cannot replace (rpm, snap, a tarball…). */
  reason?: 'dev' | 'platform'
  kind: 'appimage' | 'deb' | 'nsis' | 'mac' | 'other'
}

/** A version switch in progress, mirrored from electron-updater like `UpdateState`. */
export interface RollbackState {
  status: 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error'
  target: string | null
  percent: number
  /** A message, or a code the renderer words: `missing-platform`, `backup-failed`, `not-offered`. */
  error: string | null
  /** The settings copy taken before the download started. */
  backup: string | null
}

/**
 * Why `settings:get` / `settings:unlock` could not answer. `parse`: the file is
 * there but is not a settings document — the only case worth telling the user
 * their file is damaged. `io`: it could not be read (locked, permissions).
 */
export type SettingsErrorKind = 'parse' | 'io' | 'other'

/** Why main refused a `settings:set` without writing anything. */
export type SettingsRefusal = 'not-loaded' | 'keychain-required' | 'store-unreadable'

/**
 * What `settings:moveAside` answers: the full path the damaged file was moved to
 * (beside a symlink's target, not the link), null when
 * it was not moved because it parses now (or cannot be read), or a refusal —
 * the encrypted tokens could not be copied aside first, so nothing was moved.
 */
export type MoveAsideReply = string | null | { refused: 'secrets-copy'; dir: string }

/** What `settings:get` / `settings:unlock` answer over IPC: the reply, or why the settings could not be read. */
export type SettingsReplyWire = SettingsReply | { error: SettingsErrorKind }

export type Language =
  | 'en'
  | 'es'
  | 'de'
  | 'fr'
  | 'pt-BR'
  | 'it'
  | 'nl'
  | 'pl'
  | 'tr'
  | 'ru'
  | 'uk'
  | 'zh-CN'
  | 'ja'
  | 'ko'
  | 'ar'
  | 'he'

/** App appearance: a fixed mode or follow the operating system. */
export type ThemeMode = 'light' | 'dark' | 'auto'

/** How the toolbar and sidebar-section icons are coloured (Settings → Themes):
 *  all grey, a tint mixed into the grey, or the theme's colour in full. */
export type IconColorMode = 'mono' | 'soft' | 'full'
export const ICON_COLOR_MODES: readonly IconColorMode[] = ['mono', 'soft', 'full']

/**
 * Which hue each icon role takes (Settings → Themes → Icon colours). Every
 * palette is built from the theme's own five colours and mixes of them, so a
 * palette repaints with the theme and keeps its contrast, light or dark.
 */
export type IconPalette = 'theme' | 'cool' | 'warm' | 'forest' | 'sunset' | 'accent'
export const ICON_PALETTES: readonly IconPalette[] = ['theme', 'cool', 'warm', 'forest', 'sunset', 'accent']

export type GraphColumnId =
  | 'branch'
  | 'graph'
  | 'message'
  | 'deployment'
  | 'author'
  | 'date'
  | 'sha'
  | 'signature'

export interface GraphColumn {
  width: number // px; for 'message' it is a flex column and width is ignored; for 'graph' 0 = auto
  visible: boolean
}

export type GraphColumns = Record<GraphColumnId, GraphColumn>

export function defaultGraphColumns(): GraphColumns {
  return {
    branch: { width: 168, visible: true },
    graph: { width: 0, visible: true },
    message: { width: 0, visible: true },
    deployment: { width: 90, visible: true },
    author: { width: 160, visible: true },
    date: { width: 80, visible: true },
    sha: { width: 74, visible: true },
    signature: { width: 96, visible: true }
  }
}

/**
 * Visual style of the commit graph (palette + how the rails are drawn). Lives
 * in AppSettings so it persists per-machine and applies to every repo.
 */
export type GraphEdgeStyle = 'rounded' | 'sharp' | 'curved' | 'straight'
export type GraphDensity = 'compact' | 'comfortable' | 'spacious'
export type GraphLineWidth = 'thin' | 'normal' | 'thick'
/** How commit nodes are drawn: `normal` shows author avatars; `compact`
 *  replaces them with small dots (and stashes with a small cube). */
export type GraphNodeStyle = 'normal' | 'compact'
/**
 * How much rail topology the graph draws, chiefly how stashes are laid out:
 *   full    — each stash gets its own lane; nothing ever overlaps (richest).
 *   simple  — the previous behaviour; stashes may share lanes (more compact).
 *   minimal — stashes sit inline on their parent's lane; no extra lanes.
 */
export type GraphTopology = 'full' | 'simple' | 'minimal'
/**
 * Which slice of history the graph draws. Orthogonal to topology — this drops
 * rows, topology only changes how the remaining ones are railed.
 *   all        — every commit the log returned.
 *   linear     — HEAD's first-parent chain only; merged-in work disappears.
 *   hideMerged — the trunk plus branches that are still unmerged; anything
 *                that only exists on the far side of a finished merge goes.
 *   solo       — the first-parent chains of HEAD, the starred branches and the
 *                default branch. "My branch and the ones that matter."
 */
export type GraphFocus = 'all' | 'linear' | 'hideMerged' | 'solo'

/** A named set of lane colours for the graph rails. */
export interface GraphPalette {
  id: string
  name: string
  builtin?: boolean
  /** Lane colours, used round-robin. At least 6; more is better for wide graphs. */
  colors: string[]
}

export interface GraphStyle {
  /** Id into the built-in + custom palette list. */
  paletteId: string
  edgeStyle: GraphEdgeStyle
  density: GraphDensity
  lineWidth: GraphLineWidth
  /** Commit node rendering — avatars (`normal`) or dots (`compact`). */
  nodeStyle: GraphNodeStyle
  /** How much rail topology to draw (mainly stash lane strategy). */
  topology: GraphTopology
  /** Which commits the graph keeps. See GraphFocus. */
  focus: GraphFocus
}

export function defaultGraphStyle(): GraphStyle {
  return { paletteId: 'classic', edgeStyle: 'rounded', density: 'comfortable', lineWidth: 'normal', nodeStyle: 'normal', topology: 'full', focus: 'all' }
}

/**
 * Left-to-right order of the data columns that flow after the graph. `branch`
 * and `graph` are the fixed structural area on the left and are never part of
 * this list — they always render first.
 */
export type GraphFlowColumnId = Exclude<GraphColumnId, 'branch' | 'graph'>

export function defaultGraphColumnOrder(): GraphFlowColumnId[] {
  return ['message', 'author', 'date', 'sha', 'signature', 'deployment']
}

/** How loud a todo is in the list. `normal` is the unmarked default. */
export type TodoPriority = 'low' | 'normal' | 'high'

/**
 * Which board column a todo sits in. `done` is the same state as the ticked
 * checkbox — the two are kept in lockstep, so a todo can never be ticked and
 * sitting in `qa` at once.
 */
export type TodoStatus = 'todo' | 'progress' | 'blocked' | 'qa' | 'done'

/**
 * One checklist entry attached to a repository. Stored in app settings keyed by
 * canonical repo path — never written into the repository itself, so a todo
 * cannot leak into a commit, a diff or a colleague's clone.
 */
/**
 * A remembered place in the code: a file, a line, and enough of that line to
 * find it again after the file has moved on. Private to this machine and this
 * repository, like a todo — never written into the repo.
 */
export interface RepoBookmark {
  id: string
  /** Repo-relative, forward slashes. */
  file: string
  line: number
  /** Why it is worth coming back to. Optional — a place can speak for itself. */
  note?: string
  /** The line's text when it was marked. What makes relocation possible. */
  snippet: string
  /** Epoch ms. */
  createdAt: number
  /** Branch it was taken on — context, not a filter. */
  branch?: string
}

export interface RepoTodo {
  id: string
  title: string
  done: boolean
  /** Free-form detail shown when the todo is opened. */
  notes?: string
  priority: TodoPriority
  /** Epoch ms. Ordering key for todos of equal priority. */
  createdAt: number
  /** Epoch ms the box was ticked; cleared when it is unticked again. */
  doneAt?: number
  /** Branch that was checked out when it was written — context, not a filter. */
  branch?: string
  /** Board column. Absent on todos written before the board existed; read it
   *  through `todoStatus()`, which falls back to `done`. */
  status?: TodoStatus
  /** Parent todo when this is a subtask. One level only — a subtask never has
   *  children of its own, because a checklist that nests without limit is a
   *  project plan, and that belongs in an issue tracker. */
  parentId?: string
}

/**
 * Per-repository overrides for layout that is otherwise global. Stored in
 * AppSettings.repoLayouts keyed by repo path; any absent field falls back to
 * the corresponding global default, so a repo only stores what it customises.
 */
export interface RepoLayout {
  graphColumns?: GraphColumns
  graphColumnOrder?: GraphFlowColumnId[]
  sidebarOrder?: string[]
  sidebarHidden?: string[]
  /** Local branch names starred by the user, in the order they were pinned. */
  pinnedBranches?: string[]
  /** Explicit expand/collapse choices for sidebar sections and branch folders,
   *  keyed by section id (`local`, `prs`, …) or folder key (`grp:feature`,
   *  `rgrp:origin/feature`, `tgrp:release`, `remote:origin`, `pinned`).
   *  Absent keys fall back to the section's default. */
  sidebarExpanded?: Record<string, boolean>
}

export interface AppThemeColors {
  bg0: string
  bg1: string
  bg2: string
  bg3: string
  bg4: string
  border: string
  borderSoft: string
  text0: string
  text1: string
  text2: string
  accent: string
  green: string
  red: string
  yellow: string
  purple: string
}

export interface AppTheme {
  id: string
  name: string
  builtin?: boolean
  light: AppThemeColors
  dark: AppThemeColors
}

export interface CodeThemeColors {
  bg: string
  text: string
  comment: string
  keyword: string
  string: string
  number: string
  function: string
  title: string
  variable: string
  type: string
  builtin: string
  attr: string
  tag: string
  operator: string
  meta: string
}

export interface CodeTheme {
  id: string
  name: string
  builtin?: boolean
  light: CodeThemeColors
  dark: CodeThemeColors
}

/** Palette for the integrated terminal — a single palette per preset (terminal
 *  themes are not mode-paired the way app/code themes are). Field names match
 *  xterm's ITheme so the preset can be assigned straight to `term.options.theme`. */
export interface TerminalThemeColors {
  background: string
  foreground: string
  cursor: string
  selectionBackground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export interface TerminalTheme {
  id: string
  name: string
  builtin?: boolean
  colors: TerminalThemeColors
}

/** The account a fresh install starts with: OpenAI, no key yet. */
export function defaultAIAccount(): AIAccount {
  return {
    id: 'default',
    label: 'OpenAI',
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini'
  }
}

export function defaultAIConfig(): AIConfig {
  const account = defaultAIAccount()
  return {
    enabled: true,
    accounts: [account],
    defaultAccountId: account.id,
    assignments: {},
    provider: account.provider,
    endpoint: account.endpoint,
    apiKey: '',
    model: account.model,
    accountId: account.id,
    transport: 'openai',
    commitStyle: 'auto',
    explainStyle: 'normal',
    conflictStyle: 'clean',
    branchNamingStyle: 'prefix/description',
    customInstructions: '',
    generateDescription: true,
    coAuthor: true,
    hoverExplain: true,
    hoverExplainKey: 'shift',
    repoChat: true,
    repoChatModel: '',
    repoChatCommittedOnly: false,
    repoChatActions: true,
    repoChatReadOnly: true,
    repoChatApproval: 'ask'
  }
}

export function defaultProfile(): Profile {
  return {
    id: 'default',
    name: 'Default',
    gitName: '',
    gitEmail: '',
    githubToken: '',
    azureToken: '',
    azureOrg: '',
    gitlabToken: '',
    bitbucketToken: '',
    forgejoToken: '',
    ai: defaultAIConfig()
  }
}

export function defaultSettings(): AppSettings {
  return {
    profiles: [defaultProfile()],
    activeProfileId: 'default',
    repoProfiles: {},
    repoAliases: {},
    tabs: [],
    activeTabId: null,
    workspaces: [{ id: 'default', name: 'Default', tabs: [], activeTabId: null }],
    activeWorkspaceId: 'default',
    recentRepos: [],
    repoScanRoots: [],
    favouriteRepos: [],
    repoSectionColors: {},
    pullMode: 'default',
    appThemeId: 'githuttbr',
    codeThemeId: 'githuttbr',
    themeMode: 'auto',
    codeFontSize: 12,
    iconColors: 'soft',
    iconPalette: 'theme',
    customAppThemes: [],
    customCodeThemes: [],
    language: 'en',
    initialCommitCount: 400,
    loadMoreCount: 400,
    autoLoadOnScroll: true,
    relativeDates: true,
    commitAvatars: true,
    githubAvatars: true,
    avatarMotion: true,
    fileListView: 'path',
    groupBranches: true,
    graphColumns: defaultGraphColumns(),
    graphColumnOrder: defaultGraphColumnOrder(),
    graphStyle: defaultGraphStyle(),
    customGraphPalettes: [],
    repoLayouts: {},
    repoTodos: {},
    repoBookmarks: {},
    analyzerMode: 'onOpen',
    todosHideDone: true,
    todosManualOrder: false,
    autoFetchMinutes: 5,
    missionRefreshSeconds: 30,
    missionReleaseTiers: { limits: [...DEFAULT_RELEASE_TIERS.limits], tones: [...DEFAULT_RELEASE_TIERS.tones] },
    desktopNotifications: false,
    confirmForcePush: true,
    mergeCommit: true,
    sidebarOrder: ['local', 'todos', 'bookmarks', 'remotes', 'stashes', 'tags', 'prs', 'issues', 'milestones', 'releases', 'worktrees', 'submodules'],
    sidebarHidden: [],
    onboardingCompleted: false,
    aiAccountsNoticeSeen: false,
    ai: defaultAIConfig(),
    autoOpenChangelog: true,
    wipSnapshotMinutes: 15,
    snapshotGuard: true,
    localCiEnabled: false,
    codegraphIndexWorktrees: false,
    worktreeAutoGroup: false,
    worktreeShortLabels: true,
    worktreeCopyIgnored: false,
    maskSecrets: true,
    commentImagesFromOtherSites: false,
    showChangeGutter: true,
    showMinimap: true,
    enableLaunchJson: true,
    shortcuts: {},
    largeFileKb: 5120,
    warnOnClose: 'always',
    terminalPlacement: 'center',
    terminalCenterApplied: false,
    openTerminalOnRepoOpen: true,
    terminalThemeId: 'githuttbr',
    terminalFontSize: 12.5,
    terminalFontFamily: 'SF Mono, JetBrains Mono, Menlo, monospace',
    terminalShell: 'powershell',
    terminalPoshTheme: '',
    tabSizing: 'fit',
    sidebarSide: 'left',
    rightPanelFullHeight: false
  }
}

// ─── .githuttbr.json — the repository's own house rules ────────────────────────
//
// An optional file committed at the root of a repository. Unlike everything in
// AppSettings, it travels with the clone: whoever opens the repo inherits it.
// That is exactly why nothing in this schema can *execute* anything or *relax*
// a guard — every field is either inert data or an extra restriction. See
// docs/help/repo-config.md for the reasoning.

/** A pattern that turns a token in commit text (`ABC-123`) into a tracker link. */
export interface RepoConfigLink {
  /** JavaScript regular expression source, matched against commit text. */
  match: string
  /** Target URL. `$0` is the whole match, `$1`… the capture groups. */
  url: string
  /** Optional name of the tracker, shown in the link's tooltip. */
  label?: string
}

/** A file the repository needs but cannot track — typically a local `.env`. */
export interface RepoConfigFileReq {
  /** Repo-relative path that must exist. */
  path: string
  /** Repo-relative template to copy it from, enabling the one-click fix. */
  from?: string
  /** Why it is needed — shown verbatim in the doctor row. */
  why?: string
}

export interface RepoConfig {
  version: number
  /** Branch names or `glob*` patterns that are protected on top of the local list. */
  protect?: string[]
  links?: {
    tickets?: RepoConfigLink[]
  }
  commit?: {
    /** Allowed Conventional-Commit scopes, offered in the composer's picker. */
    scopes?: string[]
    /** Prefill the ticket key parsed out of the current branch name. */
    ticketFromBranch?: boolean
    /** Trailer lines appended on commit. `{ticket}` and `{branch}` interpolate. */
    trailers?: string[]
  }
  /** Preconditions the doctor checks when the repository is opened. */
  requires?: {
    /** Node major version or range: `20`, `20.x`, `>=20`. */
    node?: string
    submodules?: boolean
    lfs?: boolean
    /** Expected value of `core.hooksPath`, e.g. `.husky`. */
    hooksPath?: string
    files?: RepoConfigFileReq[]
  }
  checklist?: {
    /** Reminders shown once per session before the first push. */
    push?: string[]
  }
}

/** Why a field of `.githuttbr.json` was rejected. Rendered from the dictionary. */
export type RepoConfigIssueCode =
  | 'json'
  | 'version'
  | 'type'
  | 'unknown'
  | 'unsafe'
  | 'regex'
  | 'url'
  | 'limit'

export interface RepoConfigIssue {
  /** Dotted path of the offending field, e.g. `links.tickets[0].url`. */
  field: string
  code: RepoConfigIssueCode
}

export interface RepoConfigResult {
  /** Absolute path of the config file, whether or not it is there. */
  path: string
  exists: boolean
  /** The validated config — null when the file is absent or unparseable. */
  config: RepoConfig | null
  /** Everything that was rejected. A file with issues still yields a config:
   *  bad fields are dropped, the rest applies. */
  issues: RepoConfigIssue[]
}

export type DoctorStatus = 'ok' | 'warn' | 'fail'

/** One row of the machine-wide environment check (Settings → Environment). */
export type EnvCheckId = 'git' | 'lfs' | 'terminal' | 'credentialHelper' | 'gh' | 'inotify'

export interface EnvCheck {
  id: EnvCheckId
  status: DoctorStatus
  /** What was found — a version, a helper name, a number. Untranslated. */
  actual?: string
  /** A shell command that repairs it, shown for the user to copy and run. */
  fix?: string
  /** Credential helper only: set for helpers that cover just some hosts (`gh auth setup-git`). */
  perHost?: boolean
}

/**
 * A repair the doctor can perform. Deliberately a closed union: the config
 * supplies *data* (a path, a config value), never a command. Nothing a
 * repository ships can make GitHuttBr run something of its choosing.
 */
export type DoctorFix =
  | { kind: 'submodules' }
  | { kind: 'lfsPull' }
  | { kind: 'hooksPath'; value: string }
  | { kind: 'copyFile'; from: string; to: string }

export interface DoctorCheck {
  /** Stable identity for the row: `node`, `lfs`, `file:.env`… */
  id: string
  kind: 'node' | 'submodules' | 'lfs' | 'hooks' | 'file'
  status: DoctorStatus
  /** What the config asked for. */
  expected?: string
  /** What the machine actually has — absent when nothing was found at all. */
  actual?: string
  /** The repo's own explanation, from `requires.files[].why`. Untranslated. */
  why?: string
  fix?: DoctorFix
}
