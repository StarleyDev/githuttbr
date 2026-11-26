import { describe, it, expect, afterAll } from 'vitest'
import { copyFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { gitMethodIsRead, gitService } from '../src/main/git'
import { repoPath } from './helpers'
import { cloneFixture, cleanupFixtures } from './fixtures'

// The pull request image preview's local path: an image read straight from this
// clone at a full commit id, with the commit view's blob read — real git against
// the binary-images-unicode scenario, whose assets/logo.png changes between two
// commits (red 16×16, then green 32×32).
afterAll(cleanupFixtures)

const git = (repo: string, ...args: string[]): string => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim()
const pngBytes = (dataUrl: string): Buffer => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')

describe('getImageBlob — an image at a commit, from this clone', () => {
  const repo = repoPath('binary-images-unicode')
  const [after, before] = git(repo, 'log', '--format=%H', '-2', '--', 'assets/logo.png').split('\n')

  it('reads both versions of a changed image, as PNG data URLs that differ', async () => {
    const a = await gitService.getImageBlob(repo, before, 'assets/logo.png')
    const b = await gitService.getImageBlob(repo, after, 'assets/logo.png')
    expect(a.status).toBe('ok')
    expect(b.status).toBe('ok')
    if (a.status !== 'ok' || b.status !== 'ok') return
    expect(a.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    // The PNG signature, and the IHDR width: 16 before, 32 after.
    expect(pngBytes(a.dataUrl).subarray(0, 4).toString('hex')).toBe('89504e47')
    expect(pngBytes(a.dataUrl).readUInt32BE(16)).toBe(16)
    expect(pngBytes(b.dataUrl).readUInt32BE(16)).toBe(32)
  })

  it('a file not at that commit, or a commit this clone lacks, is "missing" — the host is asked then', async () => {
    const first = git(repo, 'rev-list', '--max-parents=0', 'HEAD')
    expect(await gitService.getImageBlob(repo, first, 'assets/logo.png')).toEqual({ status: 'missing' })
    expect(await gitService.getImageBlob(repo, 'f'.repeat(40), 'assets/logo.png')).toEqual({ status: 'missing' })
  })

  it('refuses a ref name, an abbreviated id, a climbing path and a non-image before git runs', async () => {
    await expect(gitService.getImageBlob(repo, 'HEAD', 'assets/logo.png')).rejects.toThrow()
    await expect(gitService.getImageBlob(repo, after.slice(0, 12), 'assets/logo.png')).rejects.toThrow()
    await expect(gitService.getImageBlob(repo, after, '../logo.png')).rejects.toThrow()
    await expect(gitService.getImageBlob(repo, after, 'data.bin')).rejects.toThrow()
  })

  it('is a read: it takes the shared lock', () => {
    expect(gitMethodIsRead('getImageBlob')).toBe(true)
  })

  it('an LFS pointer is "missing" here, so the host — which resolves LFS — is asked', async () => {
    const tmp = cloneFixture('binary-images-unicode')
    const pointer = `version https://git-lfs.github.com/spec/v1\noid sha256:${'a'.repeat(64)}\nsize 52341\n`
    writeFileSync(join(tmp, 'assets/banner.png'), pointer)
    git(tmp, 'add', '-A')
    git(tmp, '-c', 'user.name=Ana Test', '-c', 'user.email=ana@example.test', 'commit', '-qm', 'lfs pointer')
    expect(await gitService.getImageBlob(tmp, git(tmp, 'rev-parse', 'HEAD'), 'assets/banner.png')).toEqual({ status: 'missing' })
  })

  it('a renamed image with spaces and non-ASCII in its name reads at its new path', async () => {
    const tmp = cloneFixture('binary-images-unicode')
    copyFileSync(join(tmp, 'assets/icon.png'), join(tmp, 'assets/ícone novo 🎨.png'))
    git(tmp, 'rm', '-q', 'assets/icon.png')
    git(tmp, 'add', '-A')
    git(tmp, '-c', 'user.name=Ana Test', '-c', 'user.email=ana@example.test', 'commit', '-qm', 'rename icon')
    const head = git(tmp, 'rev-parse', 'HEAD')
    const r = await gitService.getImageBlob(tmp, head, 'assets/ícone novo 🎨.png')
    expect(r.status).toBe('ok')
    expect(await gitService.getImageBlob(tmp, head, 'assets/icon.png')).toEqual({ status: 'missing' })
    expect(await gitService.getImageBlob(tmp, git(tmp, 'rev-parse', 'HEAD~1'), 'assets/icon.png')).toMatchObject({ status: 'ok' })
  })
})
