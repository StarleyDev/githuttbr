import { describe, it, expect } from 'vitest'
import { githubForkSource, isGitlabForkMr } from '../src/main/hosting'
import { azureForkSource, mapAzurePr } from '../src/main/azurePr'

// The PR page offers no checkout link for a fork's source branch, so each host
// has to say when the head is not in the base repository.
describe('fork detection for pull request detail', () => {
  it('GitHub: a head in another repository is a fork', () => {
    expect(githubForkSource({ repo: { full_name: 'dev/app' } }, { repo: { full_name: 'team/app' } }, 'team')).toBe('dev/app')
    expect(githubForkSource({ repo: { full_name: 'team/app' } }, { repo: { full_name: 'team/app' } }, 'team')).toBeNull()
  })

  it('GitHub: a deleted fork (head.repo null) is still a fork when its label names another owner', () => {
    expect(githubForkSource({ label: 'dev:feat/x', repo: null }, { repo: { full_name: 'team/app' } }, 'team')).toBe('dev')
    expect(githubForkSource({ label: 'Team:feat/x', repo: null }, { repo: { full_name: 'team/app' } }, 'team')).toBeNull()
    expect(githubForkSource({ label: 'dev:feat/x', repo: null }, { repo: null }, 'team')).toBe('dev')
    expect(githubForkSource({ repo: null }, { repo: { full_name: 'team/app' } }, 'team')).toBeNull()
  })

  it('GitLab: a merge request from another project is a fork', () => {
    expect(isGitlabForkMr({ source_project_id: 12, project_id: 7 })).toBe(true)
    expect(isGitlabForkMr({ source_project_id: 7, project_id: 7 })).toBe(false)
    expect(isGitlabForkMr({})).toBe(false)
  })

  it('Azure DevOps: forkSource names the fork', () => {
    expect(azureForkSource({})).toBeNull()
    expect(
      azureForkSource({ forkSource: { name: 'refs/heads/x', repository: { name: 'app-fork', project: { name: 'Sandbox' } } } })
    ).toBe('Sandbox/app-fork')
    expect(azureForkSource({ forkSource: { repository: { name: 'app-fork' } } })).toBe('app-fork')
    const R = { org: 'example-org', project: 'Platform', repo: 'app' }
    const pr = mapAzurePr(
      R,
      { pullRequestId: 3, title: 't', status: 'active', forkSource: { repository: { name: 'app-fork' } } },
      []
    )
    expect(pr.sourceRepo).toBe('app-fork')
    expect(mapAzurePr(R, { pullRequestId: 4, title: 't', status: 'active' }, []).sourceRepo).toBeNull()
  })
})
