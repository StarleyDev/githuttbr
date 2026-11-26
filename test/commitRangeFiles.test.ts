import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { gitService, gitMethodIsRead } from '../src/main/git'
import { repoPath } from './helpers'

// getCommitRangeFiles: what one pull request update changed, read from this
// clone — the Updates tab's "View changes in this update" when both heads are
// here. Read-only against the shared change-summary fixture, whose last commit
// touches every kind of change at once.

const R = repoPath('change-summary')
const rev = (ref: string): string => execFileSync('git', ['-C', R, 'rev-parse', ref], { encoding: 'utf8' }).trim()

describe('getCommitRangeFiles', () => {
  it('is a read', () => {
    expect(gitMethodIsRead('getCommitRangeFiles')).toBe(true)
  })

  it('splits the diff of two commits into files with their patches, renames detected', async () => {
    const files = await gitService.getCommitRangeFiles(R, rev('HEAD~1'), rev('HEAD'))
    const byStatus = (s: string): string[] => files.filter((f) => f.status === s).map((f) => f.filename).sort()
    expect(byStatus('modified')).toHaveLength(6)
    expect(byStatus('added')).toHaveLength(2)
    expect(byStatus('removed')).toEqual(['src/legacy.js'])
    const renamed = files.find((f) => f.status === 'renamed')
    expect(renamed?.previousFilename).toBeTruthy()
    const client = files.find((f) => f.filename === 'src/client.js')
    expect(client?.patch).toMatch(/^@@ /)
    expect(client).toMatchObject({ additions: 1, deletions: 1 })
  })

  it('the other way round undoes it', async () => {
    const files = await gitService.getCommitRangeFiles(R, rev('HEAD'), rev('HEAD~1'))
    expect(files.find((f) => f.filename === 'src/legacy.js')?.status).toBe('added')
  })

  it('refuses anything but two full commit ids', async () => {
    await expect(gitService.getCommitRangeFiles(R, 'HEAD~1', rev('HEAD'))).rejects.toThrow(/full commit ids/)
    await expect(gitService.getCommitRangeFiles(R, rev('HEAD'), '--output=/tmp/x')).rejects.toThrow(/full commit ids/)
  })
})
