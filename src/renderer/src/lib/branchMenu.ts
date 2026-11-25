export type BranchContextKind = 'local' | 'remote'

export type BranchContextActionId = 'rename' | 'copy' | 'worktree' | 'merge' | 'delete'

export interface BranchWorktreePlan {
  dir: string
  branch: string
  newBranch: boolean
  startPoint?: string
}

export function branchContextActionIds(
  kind: BranchContextKind,
  includeMerge = true
): BranchContextActionId[] {
  const actions: BranchContextActionId[] = kind === 'local'
    ? ['rename', 'copy', 'worktree', 'merge', 'delete']
    : ['copy', 'worktree', 'merge', 'delete']
  return includeMerge ? actions : actions.filter((action) => action !== 'merge')
}

export interface ActiveBranchForMerge {
  name: string
  sha: string
  upstream: string | null
  behind: number
}

export function branchMergeWouldChange(
  ref: string,
  sha: string,
  current: ActiveBranchForMerge | undefined,
  mergedIntoCurrent = false
): boolean {
  if (!current || mergedIntoCurrent || ref === current.name || sha === current.sha) return false
  if (current.upstream === ref && current.behind === 0) return false
  return true
}

export function branchWorktreePlan(
  repoPath: string,
  localBranch: string,
  ref: string,
  localExists: boolean
): BranchWorktreePlan {
  const suffix = localBranch.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'branch'
  const dir = `${repoPath.replace(/[\\/]+$/, '')}--${suffix}`
  if (localExists) return { dir, branch: localBranch, newBranch: false }
  return { dir, branch: localBranch, newBranch: true, startPoint: ref }
}

/**
 * A worktree folder typed in the add-worktree dialog, made absolute against the
 * repository's parent folder (`../x`, `x`, or already absolute). The root is
 * kept: rebuilding from path segments alone dropped the leading `/`, so on
 * Linux and macOS the new tab opened `home/…` — a relative path that does not
 * exist — while git, which resolves `../x` itself, created the folder fine.
 */
export function resolveWorktreeDir(parent: string, dir: string): string {
  if (/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(dir)) return dir
  const joined = `${parent}/${dir}`
  const root = joined.match(/^([a-zA-Z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+[\\/]?|[\\/])/)?.[0] ?? ''
  const out: string[] = []
  for (const seg of joined.slice(root.length).split(/[\\/]+/)) {
    if (seg === '..') out.pop()
    else if (seg && seg !== '.') out.push(seg)
  }
  const head = root.replace(/\\/g, '/')
  return head + (head && !head.endsWith('/') && out.length ? '/' : '') + out.join('/')
}

/**
 * A repository path split into the folder that holds it and its own name, for
 * suggesting where a new worktree goes. The parent keeps its root: splitting on
 * separators and joining the segments back dropped the leading `/`, so the
 * add-worktree dialog suggested `home/…` and git — resolving that relative to
 * the repository — created the worktree nested inside it.
 */
export function repoParentAndName(path: string): { parent: string; repoName: string } {
  const trimmed = path.replace(/[\\/]+$/, '')
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  const repoName = trimmed.slice(cut + 1)
  if (cut < 0) return { parent: '', repoName }
  let parent = trimmed.slice(0, cut)
  // A repository right under the root keeps that root as its parent — `/` or
  // `C:/` — never an empty string that would make every suggestion relative.
  if (parent === '' || /^[a-zA-Z]:$/.test(parent)) parent += '/'
  return { parent: parent.replace(/\\/g, '/'), repoName }
}
