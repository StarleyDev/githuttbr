import { describe, it, expect, vi, afterAll } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// The directory fsync after the rename is best effort. Once the rename has
// happened every reader sees the new file, so failing the write there told the
// caller the old contents were still in place — the secrets cache then
// disagreed with the disk and served a cleared token back.

const seam = vi.hoisted(() => ({ dirSyncError: null as null | string }))

vi.mock('fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('fs/promises')>()
  const open = (async (...args: Parameters<typeof real.open>) => {
    const fh = await real.open(...args)
    if (seam.dirSyncError && (await fh.stat()).isDirectory()) {
      const code = seam.dirSyncError
      fh.sync = async () => {
        throw Object.assign(new Error(`${code}: dir fsync failed`), { code })
      }
    }
    return fh
  }) as typeof real.open
  return { ...real, default: { ...real, open }, open }
})

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-dirsync-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('writePrivateFile when the directory fsync fails', () => {
  for (const code of ['EIO', 'EBADF']) {
    it(`resolves after the rename on ${code}, with the new contents in place`, async () => {
      const { writePrivateFile } = await import('../src/main/privateFile')
      const file = join(dir, `f-${code}`)
      writeFileSync(file, 'old')
      seam.dirSyncError = code
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      try {
        await expect(writePrivateFile(file, 'new')).resolves.toBeUndefined()
      } finally {
        seam.dirSyncError = null
        warn.mockRestore()
      }
      expect(readFileSync(file, 'utf8')).toBe('new')
      if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600)
    })
  }
})
