import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { gitService, gitMethodIsRead } from '../src/main/git'
import { repoPath } from './helpers'
import { cloneFixture, cleanupFixtures } from './fixtures'

// getCommitRangeFiles: what one pull request update changed, read from this
// clone — the Updates tab's "View changes in this update" when both heads are
// here. Read-only against the shared change-summary fixture, whose last commit
// touches every kind of change at once.

const R = repoPath('change-summary')
const rev = (ref: string): string => execFileSync('git', ['-C', R, 'rev-parse', ref], { encoding: 'utf8' }).trim()

describe('getCommitRangeFiles', () => {
  afterAll(cleanupFixtures)

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

  // A user's diff.noprefix (or mnemonicPrefix) must not make added and binary
  // files vanish from the split: the app asks for a/ and b/ itself.
  for (const [key, value] of [
    ['diff.noprefix', 'true'],
    ['diff.mnemonicPrefix', 'true']
  ]) {
    it(`keeps every file with ${key}=${value} set`, async () => {
      const copy = cloneFixture('change-summary')
      execFileSync('git', ['-C', copy, 'config', key, value])
      const r = (ref: string): string => execFileSync('git', ['-C', copy, 'rev-parse', ref], { encoding: 'utf8' }).trim()
      const files = await gitService.getCommitRangeFiles(copy, r('HEAD~1'), r('HEAD'))
      const plain = await gitService.getCommitRangeFiles(R, rev('HEAD~1'), rev('HEAD'))
      expect(files.map((f) => [f.filename, f.status]).sort()).toEqual(plain.map((f) => [f.filename, f.status]).sort())
      expect(files.filter((f) => f.status === 'added')).toHaveLength(2)
    })
  }

  it('refuses anything but two full commit ids', async () => {
    await expect(gitService.getCommitRangeFiles(R, 'HEAD~1', rev('HEAD'))).rejects.toThrow(/full commit ids/)
    await expect(gitService.getCommitRangeFiles(R, rev('HEAD'), '--output=/tmp/x')).rejects.toThrow(/full commit ids/)
  })
})
