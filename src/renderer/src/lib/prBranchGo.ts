import type { BranchesPayload, RemoteInfo } from '../../../shared/types'
import { prRemoteIdentity } from './hosting'

/**
 * What it takes to land on a pull request's branch from where the repository
 * is now. Decided from the branch lists already loaded, so the common cases
 * (already there, a local branch, a fetched remote branch) cost no network.
 */
export type PrBranchCheckoutPlan =
  | { kind: 'current' }
  | { kind: 'local' }
  | { kind: 'remote'; fullName: string }
  | { kind: 'fetch' }

export function planBranchCheckout(
  branches: Pick<BranchesPayload, 'current' | 'locals' | 'remotes'>,
  name: string,
  remote: string
): PrBranchCheckoutPlan {
  if (branches.current === name) return { kind: 'current' }
  if (branches.locals.some((b) => b.name === name)) return { kind: 'local' }
  // Matched on the full name: a remote whose own name has a slash in it would
  // split `remote`/`name` in the wrong place.
  const fullName = `${remote}/${name}`
  if (branches.remotes.some((b) => b.fullName === fullName)) return { kind: 'remote', fullName }
  return { kind: 'fetch' }
}

const comparable = (u: string): string => u.replace(/\.git$/, '').replace(/\/+$/, '')

/**
 * The configured remote a pull request's repository is behind, matched on URL
 * — a repository may have several remotes, and the PR names a URL, not one of
 * them. Undefined when none matches.
 */
export function remoteForPrUrl(remotes: RemoteInfo[], prRemoteUrl: string): string | undefined {
  const target = comparable(prRemoteUrl)
  return remotes.find((r) => comparable(prRemoteIdentity(r.url)) === target)?.name
}
