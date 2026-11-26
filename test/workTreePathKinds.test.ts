import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitMethodIsRead, gitService } from '../src/main/git'
import { cloneFixture, cleanupFixtures } from './fixtures'

// The PR Files tab's "open in editor" / "reveal" only offer what is in this
// clone's working tree: one answer per path, nothing outside the repository.
afterAll(cleanupFixtures)

describe('getWorkTreePathKinds', () => {
  it('answers file, dir or null per path, and refuses what climbs out', async () => {
    const repo = cloneFixture('binary-images-unicode')
    const outside = mkdtempSync(join(tmpdir(), 'githuttbr-outside-'))
    symlinkSync(outside, join(repo, 'escape'))
    try {
      expect(
        await gitService.getWorkTreePathKinds(repo, ['assets/logo.png', 'assets', 'nope.png', '../x', '/etc', 'escape', 7])
      ).toEqual(['file', 'dir', null, null, null, null, null])
      expect(await gitService.getWorkTreePathKinds(repo, 'assets')).toEqual([])
      expect(gitMethodIsRead('getWorkTreePathKinds')).toBe(true)
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })
})
