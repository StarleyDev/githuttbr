import type { PrFile, RemoteInfo } from '../shared/types'
import { gitService, withRepoLock } from './git'

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

/** The two ends of a pull request's diff as its host defines them. */
export interface PrDiffEnds {
  /** The merge base when the host names one (Azure, GitLab, Forgejo); else the target branch's tip. */
  base: string
  head: string
  /** `base` is already the merge base: no `git merge-base` needed. */
  baseIsMergeBase: boolean
}

/** The commits a local read ended up comparing, and the files. */
export interface PrLocalFiles {
  files: PrFile[]
  mergeBase: string
}

const isFullSha = (s: string): boolean => /^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(s)

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
const localCommits = (repoPath: string, shas: string[]): Promise<string[]> =>
  withRepoLock(repoPath, 'getLocalCommits', () => gitService.getLocalCommits(repoPath, shas)).catch(() => [] as string[])

/**
 * Make sure both commits are here: fetched by id from the remote whose URL is
 * the pull request's when they are not. A quiet write — FETCH_HEAD and objects,
 * no ref — as the Updates tab does. False when they still are not here.
 */
export async function ensurePrCommits(repoPath: string, remoteUrl: string, shas: string[]): Promise<boolean> {
  return ensureCommitsFrom(repoPath, async () => {
    const remotes = await withRepoLock(repoPath, 'remotes', () => gitService.remotes(repoPath)).catch(() => [] as RemoteInfo[])
    return findRemoteForUrl(remotes, remoteUrl)
  }, shas)
}

/** ensurePrCommits with the remote already resolved — asked for only when a commit is missing. */
export async function ensureCommitsFrom(
  repoPath: string,
  remoteOf: () => Promise<string | null>,
  shas: string[]
): Promise<boolean> {
  const wanted = [...new Set(shas)]
  if (!wanted.length || !wanted.every(isFullSha)) return false
  const here = await localCommits(repoPath, wanted)
  if (here.length === wanted.length) return true
  const remote = await remoteOf()
  if (!remote) return false
  const missing = wanted.filter((s) => !here.some((h) => h.toLowerCase() === s.toLowerCase()))
  return withRepoLock(repoPath, 'fetchCommitsById', () => gitService.fetchCommitsById(repoPath, remote, missing)).catch(
    () => false
  )
}

/**
 * The pull request's files from this clone, or null when its commits cannot
 * be had here (not fetched, the server will not serve them by id, a shallow or
 * partial clone missing objects). Never throws: null sends the caller to the host.
 */
export async function readPrFilesFromClone(repoPath: string, remoteUrl: string, ends: PrDiffEnds): Promise<PrLocalFiles | null> {
  if (!isFullSha(ends.base) || !isFullSha(ends.head)) return null
  if (!(await ensurePrCommits(repoPath, remoteUrl, [ends.base, ends.head]))) return null
  try {
    const mergeBase = ends.baseIsMergeBase
      ? ends.base
      : await withRepoLock(repoPath, 'getMergeBase', () => gitService.getMergeBase(repoPath, ends.base, ends.head))
    if (!mergeBase) return null
    const files = await withRepoLock(repoPath, 'getCommitRangeFiles', () =>
      gitService.getCommitRangeFiles(repoPath, mergeBase, ends.head)
    )
    return { files, mergeBase }
  } catch {
    return null
  }
}

/**
 * One file between two commits, from this clone — a file opened on demand, or
 * read again after the host's API failed it. From the two commits' merge base,
 * as the Files tab, unless `straight` (an update: previous head → head). Null
 * when it cannot be had here.
 */
export async function readPrFileFromClone(
  repoPath: string,
  remoteUrl: string,
  ends: { base: string; head: string; straight: boolean },
  paths: string[]
): Promise<PrFile | null> {
  if (!isFullSha(ends.base) || !isFullSha(ends.head)) return null
  if (!(await ensurePrCommits(repoPath, remoteUrl, [ends.base, ends.head]))) return null
  try {
    const from = ends.straight
      ? ends.base
      : await withRepoLock(repoPath, 'getMergeBase', () => gitService.getMergeBase(repoPath, ends.base, ends.head))
    if (!from) return null
    const files = await withRepoLock(repoPath, 'getCommitRangeFiles', () =>
      gitService.getCommitRangeFiles(repoPath, from, ends.head, paths)
    )
    return files.find((f) => f.filename === paths[0]) ?? files[0] ?? null
  } catch {
    return null
  }
}
