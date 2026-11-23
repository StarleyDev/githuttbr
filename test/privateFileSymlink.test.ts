import { describe, it, expect, afterAll } from 'vitest'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { writePrivateFile } from '../src/main/privateFile'

// A settings file symlinked into a dotfiles repo: the atomic write used to
// rename over the link, replacing it with a plain file.
const dir = mkdtempSync(join(tmpdir(), 'githuttbr-private-link-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe.skipIf(process.platform === 'win32')('writing a private file through a symlink', () => {
  it('writes the target and keeps the link', async () => {
    mkdirSync(join(dir, 'dotfiles'))
    const target = join(dir, 'dotfiles', 'githuttbr-settings.json')
    const link = join(dir, 'githuttbr-settings.json')
    writeFileSync(target, '{"old":true}')
    symlinkSync(target, link)

    await writePrivateFile(link, '{"new":true}')

    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    expect(readFileSync(target, 'utf8')).toBe('{"new":true}')
    expect(lstatSync(target).mode & 0o777).toBe(0o600)
    expect(readdirSync(join(dir, 'dotfiles')).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('a dangling link whose target folder exists is written through, and the link stays', async () => {
    mkdirSync(join(dir, 'moved'))
    const target = join(dir, 'moved', 'githuttbr-settings.json')
    const link = join(dir, 'through.json')
    symlinkSync(target, link)

    await writePrivateFile(link, '{"new":true}')

    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    expect(readlinkSync(link)).toBe(target)
    expect(readFileSync(target, 'utf8')).toBe('{"new":true}')
  })

  it('a dangling link whose target folder is gone fails the write and is left alone', async () => {
    const target = join(dir, 'gone', 'githuttbr-settings.json')
    const link = join(dir, 'dangling.json')
    symlinkSync(target, link)

    await expect(writePrivateFile(link, '{"new":true}')).rejects.toThrow(/symlink.*folder does not exist/)

    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    expect(readlinkSync(link)).toBe(target)
    expect(existsSync(join(dir, 'gone'))).toBe(false)
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('a missing file is still created where asked', async () => {
    const path = join(dir, 'fresh.json')
    await writePrivateFile(path, 'x')
    expect(readFileSync(path, 'utf8')).toBe('x')
  })
})
