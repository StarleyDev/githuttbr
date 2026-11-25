import type { TabState } from '../../../shared/types'
import { canonicalRepoPath } from './repoAlias'

/**
 * Where a repository is already open, standalone or inside a group, matched by
 * path since a repo can be renamed independently. Opening the same repo twice
 * would make two tabs fight over one working tree, so callers focus this
 * instead of creating another.
 */
export function focusOpenRepo(
  tabs: TabState[],
  path: string
): { tabs: TabState[]; activeTabId: string } | null {
  // Canonical, not exact: git answers `C:/x` where a dialog stored `C:\x`, and
  // a trailing slash or a drive letter's case must not open a second tab.
  const key = canonicalRepoPath(path)
  const existing = tabs.find((t) => t.kind !== 'page' && t.repos.some((r) => canonicalRepoPath(r.path) === key))
  if (!existing || existing.kind === 'page') return null
  // The group points at the path it stored, not the spelling asked for.
  const stored = existing.repos.find((r) => canonicalRepoPath(r.path) === key)?.path ?? path
  const next =
    existing.kind === 'group'
      ? tabs.map((t) => (t.id === existing.id ? { ...t, activeRepoPath: stored } : t))
      : tabs
  return { tabs: next, activeTabId: existing.id }
}
