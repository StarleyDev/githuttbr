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

// The program is not the only word that runs: a wrapper, an assignment or a
// shell can put the mount path anywhere on the line.
const BYPASSES = [
  'env /tmp/.mount_x/gitcito-textconv',
  'FOO=1 "/tmp/.mount_x/gitcito-textconv"',
  `sh -c '/tmp/.mount_x/gitcito-textconv'`,
  'sh -c "exec /tmp/.mount_x/resources/cli/gitcito-textconv \\"$1\\"" --',
  'nice -n 5 /tmp/appimage_extracted_0123/resources/cli/gitcito-textconv',
  '/tmp/.mo""unt_x/gitcito-textconv',
  '/tmp/\\.mount_x/gitcito-textconv',
  'FOO=/tmp/.mount_x/lib pdftotext -layout - -'
]

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

  it('finds a mount path anywhere on the textconv line, not only as the program', () => {
    for (const tc of BYPASSES) expect(isEphemeralTextconv(tc, {}), tc).toBe(true)
    // Ordinary converters, and names that merely contain ".mount_", stay clean.
    for (const tc of ['pdftotext -layout - -', 'exiftool', '"/opt/Git HuttBr/resources/cli/gitcito-textconv"',
      '/home/me/project.mount_notes/conv']) {
      expect(isEphemeralTextconv(tc, {}), tc).toBe(false)
    }
  })

  it('finds a mount spelled as a glob, which the shell expands before git runs it', () => {
    for (const tc of [
      '/tmp/.moun?_X/resources/cli/gitcito-textconv',
      '/tmp/[.]mount_X/resources/cli/gitcito-textconv',
      '/tmp/*/resources/cli/gitcito-textconv',
      'env "/tmp/.mount_*/AppRun"',
      'sh -c /tmp/?mount_x/AppRun',
      '/var/x/[.]appimage_extracted_1/AppRun',
      'FOO=/tmp/appimage_extracte?_1/lib exiftool'
    ]) {
      expect(isEphemeralTextconv(tc, {}), tc).toBe(true)
    }
    expect(isEphemeralTextconv('/scratch/*/AppRun', { TMPDIR: '/scratch/' }), 'TMPDIR').toBe(true)
    // Ordinary converters, globs outside the temp dir, and temp paths without a glob stay clean.
    for (const tc of ['pdftotext -layout - -', 'exiftool', 'docx2txt', '~/bin/conv', '/tmp/conv',
      'sh -c "cat -- *"', '/usr/bin/strings -n 8']) {
      expect(isEphemeralTextconv(tc, {}), tc).toBe(false)
    }
  })

  it('finds this launch’s APPDIR or resources root anywhere on the line, under an AppImage', () => {
    const env = { APPIMAGE: '/x.AppImage', APPDIR: '/opt/custom-runtime/root' }
    expect(isEphemeralTextconv('env /opt/custom-runtime/root/resources/cli/gitcito-textconv', env)).toBe(true)
    expect(isEphemeralTextconv(`sh -c '"/opt/custom-runtime/root/x"'`, env)).toBe(true)
    // The resources root, when it does not sit under APPDIR or look like a mount.
    const bare = { APPIMAGE: '/x.AppImage' }
    expect(isEphemeralTextconv('env /opt/odd/resources/cli/gitcito-textconv', bare, '/opt/odd/resources')).toBe(true)
    // Not an AppImage: an installed resources root is a fine place for a converter.
    expect(isEphemeralTextconv('env /opt/odd/resources/cli/gitcito-textconv', {}, '/opt/odd/resources')).toBe(false)
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

  it('refuses, and flags, a mount path hidden behind a wrapper', async () => {
    const R = cloneFixture('bisect-bug')
    for (const tc of BYPASSES) {
      await expect(gitService.setDiffDriver(R, 'word', tc), tc).rejects.toThrow(/AppImage/)
    }
    expect((await gitService.diffDrivers(R)).some((d) => d.name === 'word')).toBe(false)
    const { execFileSync } = await import('node:child_process')
    for (const [i, tc] of BYPASSES.entries()) {
      execFileSync('git', ['config', '--local', `diff.w${i}.textconv`, tc], { cwd: R })
    }
    const flagged = (await gitService.diffDrivers(R)).filter((d) => /^w\d+$/.test(d.name))
    expect(flagged).toHaveLength(BYPASSES.length)
    for (const d of flagged) expect(d.ephemeral, d.textconv).toBe(true)
  })

  it('refuses a converter under this AppImage’s own root, whatever it is called', async () => {
    const R = cloneFixture('bisect-bug')
    const saved = { APPIMAGE: process.env.APPIMAGE, APPDIR: process.env.APPDIR }
    process.env.APPIMAGE = '/x/Git HuttBr.AppImage'
    process.env.APPDIR = '/opt/custom-runtime/root'
    try {
      await expect(
        gitService.setDiffDriver(R, 'word', 'env /opt/custom-runtime/root/resources/cli/gitcito-textconv')
      ).rejects.toThrow(/AppImage/)
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
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
