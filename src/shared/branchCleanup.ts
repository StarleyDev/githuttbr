// Pure helpers behind the branch cleanup's "commits that exist only here"
// count. The main process runs one `git rev-list --parents` over every local
// branch minus every remote-tracking ref and the default branch; these turn
// that single listing into a per-branch number without another git call.

/** A branch's unique-commit count stops here: past it, "a lot" is the honest answer. */
export const UNIQUE_COMMIT_CAP = 500

/**
 * `<sha> <parent> <parent>…` lines from `git rev-list --parents` into a map.
 * Every key is a commit that no remote-tracking ref and no default branch
 * reaches; parents outside that set are kept as listed and simply not found.
 */
export function parseRevListParents(out: string): Map<string, string[]> {
  const graph = new Map<string, string[]>()
  for (const line of out.split('\n')) {
    const parts = line.trim().split(' ').filter(Boolean)
    if (parts.length) graph.set(parts[0], parts.slice(1))
  }
  return graph
}

/**
 * How many commits of `unique` the branch at `tip` reaches, up to `cap`.
 *
 * Walking only inside the set is exact: a commit on the way down that some
 * remote reaches would make everything below it reachable from that remote
 * too, so it could not be in the set in the first place.
 */
export function countUniqueCommits(
  unique: Map<string, string[]>,
  tip: string,
  cap = UNIQUE_COMMIT_CAP
): { count: number; capped: boolean } {
  if (!unique.has(tip)) return { count: 0, capped: false }
  const seen = new Set<string>()
  const stack = [tip]
  while (stack.length) {
    const sha = stack.pop()!
    if (seen.has(sha)) continue
    const parents = unique.get(sha)
    if (!parents) continue
    seen.add(sha)
    if (seen.size >= cap) return { count: cap, capped: true }
    for (const p of parents) if (!seen.has(p)) stack.push(p)
  }
  return { count: seen.size, capped: false }
}

/** `branch.<name>.remote` / `.merge` out of `git config --get-regexp`, keyed by branch name. */
export function parseBranchTrackingConfig(out: string): Map<string, { remote?: string; merge?: string }> {
  const byBranch = new Map<string, { remote?: string; merge?: string }>()
  for (const line of out.split('\n')) {
    const space = line.indexOf(' ')
    if (space < 0) continue
    const key = line.slice(0, space)
    const value = line.slice(space + 1)
    const m = /^branch\.(.+)\.(remote|merge)$/.exec(key)
    if (!m) continue
    const entry = byBranch.get(m[1]) ?? {}
    entry[m[2] as 'remote' | 'merge'] = value
    byBranch.set(m[1], entry)
  }
  return byBranch
}
