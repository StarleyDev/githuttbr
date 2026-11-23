import { describe, it, expect, afterAll } from 'vitest'
import { join } from 'node:path'
import {
  isEphemeralAppPath,
  isEphemeralTextconv,
  persistBlocker,
  runningFromAppImage,
  textconvProgram
} from '../src/main/appImagePaths'
import { bundledTextconvPath, gitService } from '../src/main/git'
import { cloneFixture, cleanupFixtures } from './fixtures'
import { ROOT } from './helpers'

afterAll(cleanupFixtures)

const MOUNT = '/tmp/.mount_Git HuO2TrCj'
const APPIMAGE_ENV = { APPIMAGE: '/home/me/Apps/Git HuttBr.AppImage', APPDIR: MOUNT }

describe('AppImage path decisions', () => {
  it('knows an AppImage launch by APPIMAGE', () => {
    expect(runningFromAppImage(APPIMAGE_ENV)).toBe(true)
    expect(runningFromAppImage({})).toBe(false)
  })

  it('treats any AppImage mount or extraction dir as ephemeral, live or stale', () => {
    expect(isEphemeralAppPath(`${MOUNT}/resources/cli/gitcito`, {})).toBe(true)
    // A mount from an earlier launch — the dangerous case — matches by shape.
    expect(isEphemeralAppPath('/tmp/.mount_GitcitXYZ/resources/cli/gitcito-textconv', APPIMAGE_ENV)).toBe(true)
    expect(isEphemeralAppPath('/var/tmp/.mount_abc/x', {})).toBe(true)
    expect(isEphemeralAppPath('/tmp/appimage_extracted_0123abcd/resources/cli/gitcito', {})).toBe(true)
  })

  it('treats this launch’s APPDIR as ephemeral whatever it is called', () => {
    const env = { APPIMAGE: '/x.AppImage', APPDIR: '/opt/custom-runtime/root' }
    expect(isEphemeralAppPath('/opt/custom-runtime/root/resources/cli/gitcito', env)).toBe(true)
    expect(isEphemeralAppPath('/opt/custom-runtime/rootless/x', env)).toBe(false)
    // APPDIR without APPIMAGE is just some variable, not a mount.
    expect(isEphemeralAppPath('/opt/custom-runtime/root/x', { APPDIR: '/opt/custom-runtime/root' })).toBe(false)
  })

  it('leaves installed locations alone', () => {
    for (const p of [
      '/opt/Git HuttBr/resources/cli/gitcito',
      '/Applications/Git HuttBr.app/Contents/Resources/cli/gitcito',
      '/home/me/.mounted/x',
      '/home/me/project.mount_notes/x',
      ''
    ]) {
      expect(isEphemeralAppPath(p, {})).toBe(false)
    }
  })

  it('blocks persisting a bundled path only under an AppImage', () => {
    expect(persistBlocker(`${MOUNT}/resources/cli/gitcito-textconv`, `${MOUNT}/resources`, APPIMAGE_ENV)).toBe('appimage')
    // An AppImage whose root does not look like a mount is still refused.
    const env = { APPIMAGE: '/x.AppImage' }
    expect(persistBlocker('/opt/odd/resources/cli/gitcito-textconv', '/opt/odd/resources', env)).toBe('appimage')
    expect(persistBlocker('/opt/Git HuttBr/resources/cli/gitcito-textconv', '/opt/Git HuttBr/resources', {})).toBeNull()
  })

  it('finds the program in a textconv command line', () => {
    expect(textconvProgram(`"${MOUNT}/resources/cli/gitcito-textconv"`)).toBe(`${MOUNT}/resources/cli/gitcito-textconv`)
    expect(textconvProgram(`'/tmp/.mount_a/b' --x`)).toBe('/tmp/.mount_a/b')
    expect(textconvProgram('pdftotext -layout - -')).toBe('pdftotext')
    expect(isEphemeralTextconv(`"${MOUNT}/resources/cli/gitcito-textconv"`, {})).toBe(true)
    expect(isEphemeralTextconv('pdftotext -layout - -', {})).toBe(false)
  })
})

describe('textconv drivers and AppImage mounts', () => {
  it('flags a configured converter inside a mount, even one that no longer exists', async () => {
    const R = cloneFixture('bisect-bug')
    const { execFileSync } = await import('node:child_process')
    // What an AppImage build of 4.37 wrote: written straight with git, since
    // setDiffDriver now refuses the path.
    execFileSync('git', ['config', '--local', 'diff.word.textconv', `"${MOUNT}/resources/cli/gitcito-textconv"`], {
      cwd: R
    })
    const word = (await gitService.diffDrivers(R)).find((d) => d.name === 'word')!
    expect(word.ephemeral).toBe(true)
  })

  it('refuses to write a converter path inside a mount', async () => {
    const R = cloneFixture('bisect-bug')
    await expect(
      gitService.setDiffDriver(R, 'word', `"/tmp/.mount_GitcitXYZ/resources/cli/gitcito-textconv"`)
    ).rejects.toThrow(/AppImage/)
    expect((await gitService.diffDrivers(R)).some((d) => d.name === 'word')).toBe(false)
    // Clearing one always works — that is the repair.
    await expect(gitService.setDiffDriver(R, 'word', '')).resolves.toBeUndefined()
  })

  it('offers the bundled converter disabled, with the reason, when running as an AppImage', async () => {
    const R = cloneFixture('bisect-bug')
    const saved = { APPIMAGE: process.env.APPIMAGE, APPDIR: process.env.APPDIR }
    // In the test run the shim sits under the repo; pretend that is the mount.
    process.env.APPIMAGE = '/x/Git HuttBr.AppImage'
    process.env.APPDIR = ROOT
    try {
      expect(bundledTextconvPath().startsWith(join(ROOT, 'resources'))).toBe(true)
      for (const s of (await gitService.diffDriverSuggestions(R)).filter((x) => x.bundled)) {
        expect(s.available).toBe(false)
        expect(s.unavailableReason).toBe('appimage')
      }
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
    const word = (await gitService.diffDriverSuggestions(R)).find((s) => s.name === 'word')!
    expect(word.available).toBe(true)
    expect(word.unavailableReason).toBeUndefined()
  })
})
