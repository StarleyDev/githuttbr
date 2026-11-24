import type { RegistryRepo, RepoScanRoot } from '../../../shared/types'
import type { TranslationKey } from '../i18n'
import { canonicalRepoPath } from './repoAlias'

/** What a scan reports back to the user. */
export interface ScanCounts {
  found: number
  added: number
}

/** A folder path in a form two spellings of the same folder agree on: the
 *  repository key (`canonicalRepoPath` — slashes, drive letter), trimmed, and
 *  on Windows lower-cased whole, since Windows does not tell `C:\Code` from
 *  `c:\code` — a looser match than a repo key needs, right for "same folder". */
function folderKey(path: string): string {
  const key = canonicalRepoPath(path.trim()) || '/'
  return /^[a-z]:/i.test(key) ? key.toLowerCase() : key
}

/** Whether `path` is already one of the scanned folders. */
export function hasScanRoot(roots: RepoScanRoot[], path: string): boolean {
  const key = folderKey(path)
  return roots.some((r) => folderKey(r.path) === key)
}

/** The toast after a scan. Counting only new repositories read as "found
 *  nothing" on every scan after the first, so the total comes first. */
export function scanSummaryMessage(counts: ScanCounts): {
  key: TranslationKey
  vars: Record<string, number>
} {
  if (counts.found === 0) return { key: 'repos.scanFoundNone', vars: {} }
  return { key: 'repos.scanFound', vars: { n: counts.found, added: counts.added } }
}

/** Whether `path` is `root` itself or somewhere below it. */
function isWithin(root: string, path: string): boolean {
  const r = folderKey(root)
  const p = folderKey(path)
  return p === r || p.startsWith(r.endsWith('/') ? r : `${r}/`)
}

export interface ScanRootGroup {
  root: RepoScanRoot
  repos: RegistryRepo[]
}

/** Whether `repo` belongs to the scanned folder `root`: below it on disk, or
 *  found by a scan of it — a repository reached through a link in the folder
 *  is stored by its real path, which need not be below the folder at all. */
function belongsTo(root: string, repo: RegistryRepo): boolean {
  if (isWithin(root, repo.path)) return true
  const key = folderKey(root)
  return repo.foundUnder?.some((f) => folderKey(f) === key) ?? false
}

/** The indexed repositories under each scanned folder, in the folders' order.
 *  A repository under two overlapping folders is listed once, under the deeper
 *  one — the folder that describes it best. Missing folders are left out: the
 *  list is for opening, and a vanished folder cannot be opened. */
export function groupByScanRoot(roots: RepoScanRoot[], repos: RegistryRepo[]): ScanRootGroup[] {
  const groups = roots.map((root) => ({ root, repos: [] as RegistryRepo[] }))
  for (const repo of repos) {
    if (repo.missing) continue
    let best: ScanRootGroup | undefined
    for (const g of groups) {
      if (!belongsTo(g.root.path, repo)) continue
      if (!best || folderKey(g.root.path).length > folderKey(best.root.path).length) best = g
    }
    best?.repos.push(repo)
  }
  for (const g of groups) g.repos.sort((a, b) => a.name.localeCompare(b.name))
  return groups
}
