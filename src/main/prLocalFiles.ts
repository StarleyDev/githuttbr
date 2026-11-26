import type { PrDiffCommits, PrFile, PrFilesFetchMode, RemoteInfo } from '../shared/types'
import { fetchCommitsByIdQuietly, gitService, QUIET_FETCH_TIMEOUT_MS, withRepoLock } from './git'
import { muteRepoWatches } from './watcher'

/**
 * A pull request's Files tab, read from this clone when it can be. `git diff`
 * between the merge base and the head is exact, has no file cap, no throttle
 * and no "too large for the API" — what every host's API falls short on in its
 * own way (Azure DevOps sends no patch at all; GitHub stops at 3000 files and
 * drops large patches; GitLab marks big diffs `too_large`). The host is only
 * asked for the two commits; the diff is computed here.
 *
 * The same pattern as the Updates tab's PrUpdateDiff: here first, then the two
 * commits fetched by id from the pull request's remote, then — the caller's
 * part — the host's API.
 */

/**
 * When the Files tab may fetch the pull request's commits it does not have:
 * - `none` — never (a reload after a comment, a review, a merge);
 * - `once` — the page's first load: at most one attempt per commits, per session;
 *   a failed one is not tried again;
 * - `refresh` — the Refresh button: a failed attempt is tried again.
 */
export type PrFetchMode = PrFilesFetchMode

/** The commits a local read compared, and the files. */
export interface PrLocalFiles {
  files: PrFile[]
  mergeBase: string
}

const isFullSha = (s: string | null | undefined): s is string => !!s && /^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(s)

/**
 * A remote URL as a pull request names it, without user, password, query or
 * `.git` — so `https://user@host/x.git` and `https://host/x` match. The same
 * comparison as the renderer's remoteForPrUrl (lib/prBranchGo.ts).
 */
export function comparableRemoteUrl(raw: string): string {
  let id = ''
  if (/^[\w.-]+@[\w.-]+:[^/]/.test(raw)) id = raw
  else {
    try {
      const url = new URL(raw)
      if (['https:', 'http:', 'ssh:', 'git:'].includes(url.protocol)) {
        url.username = ''
        url.password = ''
        url.search = ''
        url.hash = ''
        id = url.href
      }
    } catch {
      id = ''
    }
  }
  return id.replace(/\.git$/, '').replace(/\/+$/, '')
}

export function findRemoteForUrl(remotes: readonly RemoteInfo[], remoteUrl: string): string | null {
  const target = comparableRemoteUrl(remoteUrl)
  if (!target) return null
  return remotes.find((r) => comparableRemoteUrl(r.url) === target)?.name ?? null
}

/** Which of `shas` this clone has, under the repository's read lock. */
const getHereCommits = (repoPath: string, shas: string[]): Promise<string[]> =>
  withRepoLock(repoPath, 'getLocalCommits', () => gitService.getLocalCommits(repoPath, shas)).catch(() => [] as string[])

/** Whether both commits are here. */
export async function hasPrCommits(repoPath: string, shas: string[]): Promise<boolean> {
  const wanted = [...new Set(shas)]
  return wanted.every(isFullSha) && (await getHereCommits(repoPath, wanted)).length === wanted.length
}

/** One attempt per (repository, commits) this session: in flight, or done with its result. */
const fetchAttempts = new Map<string, { done: boolean; run: Promise<boolean> }>()

/** Forget every attempt — for the tests; the app keeps them for the session. */
export function clearPrFetchAttempts(): void {
  fetchAttempts.clear()
}

/**
 * Make sure both commits are here: fetched by id from the remote whose URL is
 * the pull request's when they are not, as `mode` allows. A quiet write —
 * objects only (fetchCommitsByIdQuietly), the watcher muted for it. Two calls
 * for the same commits share one fetch. `onFetching` is told when a fetch
 * starts and ends, for the tab's hint. False when they still are not here.
 */
export async function ensurePrCommits(
  repoPath: string,
  remoteUrl: string,
  shas: string[],
  mode: PrFetchMode,
  onFetching?: (fetching: boolean) => void
): Promise<boolean> {
  const remoteOf = async (): Promise<string | null> => {
    const remotes = await withRepoLock(repoPath, 'remotes', () => gitService.remotes(repoPath)).catch(() => [] as RemoteInfo[])
    return findRemoteForUrl(remotes, remoteUrl)
  }
  return ensureCommitsFrom(repoPath, remoteOf, shas, mode, onFetching)
}

/** ensurePrCommits with the remote resolved by `remoteOf` — asked only when a commit is missing. */
export async function ensureCommitsFrom(
  repoPath: string,
  remoteOf: () => Promise<string | null>,
  shas: string[],
  mode: PrFetchMode,
  onFetching?: (fetching: boolean) => void
): Promise<boolean> {
  const wanted = [...new Set(shas)]
  if (!wanted.length || !wanted.every(isFullSha)) return false
  const here = await getHereCommits(repoPath, wanted)
  if (here.length === wanted.length) return true
  if (mode === 'none') return false
  const key = [repoPath, ...wanted.map((s) => s.toLowerCase()).sort()].join('\0')
  const prior = fetchAttempts.get(key)
  // In flight: wait for it. Done and this is not a Refresh: its answer stands.
  if (prior && (!prior.done || mode === 'once')) return prior.run
  const missing = wanted.filter((s) => !here.some((h) => h.toLowerCase() === s.toLowerCase()))
  const entry = { done: false, run: Promise.resolve(false) }
  entry.run = (async (): Promise<boolean> => {
    const remote = await remoteOf()
    if (!remote) return false
    onFetching?.(true)
    // Objects land under .git/objects (watcher noise anyway); the mute covers the rest of the churn.
    muteRepoWatches(repoPath, QUIET_FETCH_TIMEOUT_MS + 2000)
    try {
      return await withRepoLock(repoPath, 'fetchCommitsById', () => fetchCommitsByIdQuietly(repoPath, remote, missing))
    } catch {
      return false
    } finally {
      muteRepoWatches(repoPath, 1500)
      onFetching?.(false)
    }
  })().finally(() => {
    entry.done = true
  })
  fetchAttempts.set(key, entry)
  return entry.run
}

/** The merge base of two commits, from this clone — null when either is not here. */
export async function getLocalMergeBase(repoPath: string, base: string, head: string): Promise<string | null> {
  if (!(await hasPrCommits(repoPath, [base, head]))) return null
  return withRepoLock(repoPath, 'getMergeBase', () => gitService.getMergeBase(repoPath, base, head)).catch(() => null)
}

/**
 * The pull request's files from this clone, from its merge base to its head —
 * or null when that cannot be had here (no merge base named, a commit or an
 * object missing). Never fetches (ensurePrCommits does), never throws: null
 * sends the caller to the host.
 */
export async function readPrFilesFromClone(repoPath: string, commits: PrDiffCommits): Promise<PrLocalFiles | null> {
  const base = commits.baseSha
  if (commits.baseKind !== 'mergeBase' || !isFullSha(base) || !isFullSha(commits.headSha)) return null
  if (!(await hasPrCommits(repoPath, [base, commits.headSha]))) return null
  try {
    const files = await withRepoLock(repoPath, 'getCommitRangeFiles', () =>
      gitService.getCommitRangeFiles(repoPath, base, commits.headSha)
    )
    return { files, mergeBase: base }
  } catch {
    return null
  }
}

/**
 * One file between two commits, from this clone — a file opened on demand, or
 * read again after the host's API failed it. From the two commits' merge base,
 * as the Files tab, unless `straight` (an update: previous head → head). Null
 * when it cannot be had here. Never fetches: the notice's button does that.
 */
export async function readPrFileFromClone(
  repoPath: string,
  ends: { base: string; head: string; straight: boolean },
  paths: string[]
): Promise<PrFile | null> {
  if (!(await hasPrCommits(repoPath, [ends.base, ends.head]))) return null
  try {
    const from = ends.straight ? ends.base : await getLocalMergeBase(repoPath, ends.base, ends.head)
    if (!from) return null
    const files = await withRepoLock(repoPath, 'getCommitRangeFiles', () =>
      gitService.getCommitRangeFiles(repoPath, from, ends.head, paths)
    )
    return files.find((f) => f.filename === paths[0]) ?? files[0] ?? null
  } catch {
    return null
  }
}
