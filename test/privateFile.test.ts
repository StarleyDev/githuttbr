import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync, chmodSync } from 'fs'
import { readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { copyPrivateFile, updatePrivateFile, writePrivateFile } from '../src/main/privateFile'

// The user-data files are rewritten whole on every save. Written in place, a
// reader in between saw half a document (and the settings reader took that for
// "no settings"), and two writes at once left a file neither of them wrote.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-private-file-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('writePrivateFile', () => {
  it('a reader never sees a half-written file', async () => {
    const f = join(dir, 'torn.json')
    for (const size of [2000, 20000, 100000]) {
      const data = JSON.stringify({ x: 'a'.repeat(size) })
      await writePrivateFile(f, data)
      let torn = 0
      let reads = 0
      const end = Date.now() + 400
      const writer = (async () => {
        while (Date.now() < end) await writePrivateFile(f, data)
      })()
      const reader = (async () => {
        while (Date.now() < end) {
          reads++
          try {
            JSON.parse(await readFile(f, 'utf-8'))
          } catch {
            torn++
          }
        }
      })()
      await Promise.all([writer, reader])
      expect(reads).toBeGreaterThan(10)
      expect(torn, `size ${size}`).toBe(0)
    }
  })

  it('two writes at once leave one of them, whole — the later one', async () => {
    const f = join(dir, 'mix.bin')
    let mixed = 0
    let outOfOrder = 0
    for (let r = 0; r < 300; r++) {
      const a = 'A'.repeat(200000)
      const b = 'B'.repeat(1000)
      await Promise.all([writePrivateFile(f, a), writePrivateFile(f, b)])
      const s = await readFile(f, 'utf8')
      if (s !== a && s !== b) mixed++
      else if (s !== b) outOfOrder++
    }
    expect(mixed).toBe(0)
    expect(outOfOrder).toBe(0)
  })

  it.skipIf(process.platform === 'win32')('is owner-only, and leaves no temporary file behind', async () => {
    const f = join(dir, 'mode.json')
    writeFileSync(f, '{}')
    chmodSync(f, 0o644)
    await writePrivateFile(f, '{"a":1}')
    expect(statSync(f).mode & 0o777).toBe(0o600)
    expect(readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toEqual([])
  })

  it('a failed write leaves the old file whole and no temporary file', async () => {
    const f = join(dir, 'missing-dir', 'x.json')
    await expect(writePrivateFile(f, 'x')).rejects.toThrow()
    const g = join(dir, 'keep.json')
    await writePrivateFile(g, 'old')
    await expect(writePrivateFile(g, 42 as never)).rejects.toThrow()
    expect(await readFile(g, 'utf8')).toBe('old')
    expect(readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toEqual([])
  })
})

describe('updatePrivateFile', () => {
  it('sees the file as the queue leaves it, so a stale rewrite can step aside', async () => {
    const f = join(dir, 'cas.json')
    await writePrivateFile(f, 'read')
    const save = writePrivateFile(f, 'saved')
    const rewrite = updatePrivateFile(f, (current) => (current === 'read' ? 'stale' : null))
    await Promise.all([save, rewrite])
    expect(await rewrite).toBe(false)
    expect(await readFile(f, 'utf8')).toBe('saved')
  })

  it('treats a missing file as null', async () => {
    const f = join(dir, 'absent.json')
    expect(await updatePrivateFile(f, (current) => (current === null ? 'new' : null))).toBe(true)
    expect(await readFile(f, 'utf8')).toBe('new')
  })
})

describe('copyPrivateFile', () => {
  it.skipIf(process.platform === 'win32')('copies owner-only', async () => {
    const from = join(dir, 'src.txt')
    writeFileSync(from, 'payload')
    chmodSync(from, 0o644)
    const to = join(dir, 'dst.txt')
    await copyPrivateFile(from, to)
    expect(await readFile(to, 'utf8')).toBe('payload')
    expect(statSync(to).mode & 0o777).toBe(0o600)
  })
})
