import { describe, it, expect } from 'vitest'
import type { BranchInfo, RemoteBranchInfo } from '../src/shared/types'
import { planBranchCheckout, remoteForPrUrl } from '../src/renderer/src/lib/prBranchGo'

const local = (name: string): BranchInfo => ({
  name,
  sha: 'a'.repeat(40),
  upstream: null,
  ahead: 0,
  behind: 0,
  isCurrent: false,
  mergedIntoCurrent: false
})
const tracking = (remote: string, name: string): RemoteBranchInfo => ({
  remote,
  name,
  fullName: `${remote}/${name}`,
  sha: 'b'.repeat(40),
  mergedIntoCurrent: false
})

describe('planBranchCheckout', () => {
  const branches = {
    current: 'main',
    locals: [local('main'), local('feature/login')],
    remotes: [
      tracking('origin', 'main'),
      tracking('origin', 'feature/login'),
      tracking('origin', 'feature/cart'),
      tracking('upstream', 'feature/search')
    ]
  }

  it('does nothing for the branch already checked out', () => {
    expect(planBranchCheckout(branches, 'main', 'origin')).toEqual({ kind: 'current' })
  })

  it('switches to a local branch before looking at the remote', () => {
    expect(planBranchCheckout(branches, 'feature/login', 'origin')).toEqual({ kind: 'local' })
  })

  it('tracks a fetched remote branch of the PR remote', () => {
    expect(planBranchCheckout(branches, 'feature/cart', 'origin')).toEqual({ kind: 'remote', fullName: 'origin/feature/cart' })
  })

  it('fetches when the branch is only on another remote, or on none', () => {
    expect(planBranchCheckout(branches, 'feature/search', 'origin')).toEqual({ kind: 'fetch' })
    expect(planBranchCheckout(branches, 'feature/new', 'origin')).toEqual({ kind: 'fetch' })
  })

  // The branch list splits `team/a/fix` at its first slash (remote `team`);
  // the full name is what `refs/remotes/<remote>/<name>` actually is.
  it('matches on the full name, so a remote with a slash still resolves', () => {
    const odd = { current: 'main', locals: [], remotes: [{ ...tracking('team', 'a/fix') }] }
    expect(planBranchCheckout(odd, 'fix', 'team/a')).toEqual({ kind: 'remote', fullName: 'team/a/fix' })
  })
})

describe('remoteForPrUrl', () => {
  const remotes = [
    { name: 'origin', url: 'https://user:secret@git.example.test/team/app.git' },
    { name: 'mirror', url: 'https://git.example.test/team/app-mirror' }
  ]

  it('finds the remote by URL, ignoring credentials, .git and a trailing slash', () => {
    expect(remoteForPrUrl(remotes, 'https://git.example.test/team/app')).toBe('origin')
    expect(remoteForPrUrl(remotes, 'https://git.example.test/team/app-mirror/')).toBe('mirror')
  })

  it('is undefined when no remote points at the PR repository', () => {
    expect(remoteForPrUrl(remotes, 'https://git.example.test/other/app')).toBeUndefined()
    expect(remoteForPrUrl([], 'https://git.example.test/team/app')).toBeUndefined()
  })
})
