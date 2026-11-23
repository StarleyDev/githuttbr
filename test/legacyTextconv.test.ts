import { describe, it, expect, afterAll, beforeEach, afterEach } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  bundledTextconvPath,
  gitMethodIsRead,
  gitService,
  repointGlobalLegacyTextconvs,
  resetGlobalTextconvRepoint
} from '../src/main/git'
import { cloneFixture, cleanupFixtures } from './fixtures'
import { ROOT } from './helpers'

// 4.38 wrote `diff.<name>.textconv = "<install>/resources/cli/gitcito-textconv"`.
// 4.39 repoints those entries at the converter it ships: the global config at
// start-up, a repository's own config when it is opened.

afterAll(() => cleanupFixtures())

const LEGACY = '"/opt/Git HuttBr/resources/cli/gitcito-textconv"'
const current = (): string => `"${bundledTextconvPath()}"`

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
}

/** A repository whose JSON diffs go through the `json` driver, with one JSON commit. */
function jsonRepo(): string {
  const R = cloneFixture('bisect-bug')
  writeFileSync(join(R, '.gitattributes'), '*.json diff=json\n')
  writeFileSync(join(R, 'data.json'), '{"zeta":1,"alpha":2}\n')
  git(R, 'add', '.gitattributes', 'data.json')
  git(R, '-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-qm', 'json')
  return R
}

const saved: Record<string, string | undefined> = {}
function setEnv(vars: Record<string, string>): void {
  for (const [k, v] of Object.entries(vars)) {
    if (!(k in saved)) saved[k] = process.env[k]
    process.env[k] = v
  }
}

beforeEach(() => resetGlobalTextconvRepoint())
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
    delete saved[k]
  }
})

describe('repointLegacyDiffDrivers, in a repository', () => {
  it('is a write, so it takes the exclusive lock', () => {
    expect(gitMethodIsRead('repointLegacyDiffDrivers')).toBe(false)
  })

  it('repoints the 4.38 converter, keeps others, and the diff runs the new one', async () => {
    const R = jsonRepo()
    git(R, 'config', '--local', 'diff.json.textconv', LEGACY)
    git(R, 'config', '--local', 'diff.word.textconv', `${LEGACY} --plain`)
    git(R, 'config', '--local', 'diff.pdf.textconv', 'pdftotext -layout - -')
    git(R, 'config', '--local', 'diff.msys.textconv', '"/c/Program Files/Tools/conv.exe"')

    // Before: git cannot even start the converter.
    const before = spawnSync('git', ['-C', R, 'show', '--textconv', 'HEAD', '--', 'data.json'], { encoding: 'utf8' })
    expect(before.status).not.toBe(0)
    expect(before.stderr).toContain('gitcito-textconv')

    const changed = await gitService.repointLegacyDiffDrivers(R)
    expect(changed).toEqual([
      { name: 'json', previous: LEGACY, next: current(), scope: 'repo' },
      { name: 'word', previous: `${LEGACY} --plain`, next: `${current()} --plain`, scope: 'repo' }
    ])
    expect(git(R, 'config', '--local', 'diff.json.textconv').trim()).toBe(current())
    expect(git(R, 'config', '--local', 'diff.pdf.textconv').trim()).toBe('pdftotext -layout - -')
    expect(git(R, 'config', '--local', 'diff.msys.textconv').trim()).toBe('"/c/Program Files/Tools/conv.exe"')

    // Nothing is flagged stale any more — not the MSYS path either, which
    // this machine cannot resolve but which is not ours to judge.
    const drivers = await gitService.diffDrivers(R)
    expect(drivers.filter((d) => d.stale)).toEqual([])

    const after = spawnSync('git', ['-C', R, 'show', '--textconv', 'HEAD', '--', 'data.json'], { encoding: 'utf8' })
    if (existsSync(join(ROOT, 'out/main/textconvCli.js'))) {
      // Built: the bundled converter really runs, and sorts the keys.
      expect(after.status).toBe(0)
      expect(after.stdout.indexOf('"alpha"')).toBeLessThan(after.stdout.indexOf('"zeta"'))
    } else {
      // Not built (the suite runs before `npm run build` in CI): git now
      // reaches the shipped shim, which looks for the compiled entry point.
      expect(after.stderr).not.toContain('gitcito-textconv')
      expect(after.stderr).toContain('textconvCli.js')
    }

    // Done once: a second open has nothing left to change.
    expect(await gitService.repointLegacyDiffDrivers(R)).toEqual([])
  })

  it('leaves the old entry, and its stale badge, when running as an AppImage', async () => {
    const R = jsonRepo()
    git(R, 'config', '--local', 'diff.json.textconv', LEGACY)
    // This "AppImage" is mounted at the checkout, so the shipped shim is inside it.
    setEnv({ APPIMAGE: '/x/GitHuttBr.AppImage', APPDIR: ROOT })
    expect(await gitService.repointLegacyDiffDrivers(R)).toEqual([])
    expect(git(R, 'config', '--local', 'diff.json.textconv').trim()).toBe(LEGACY)
    const json = (await gitService.diffDrivers(R)).find((d) => d.name === 'json')!
    expect(json.stale).toBe(true)
  })

  it('never rewrites an entry inside an AppImage mount: it keeps its own flag and Remove button', async () => {
    const R = jsonRepo()
    const mount = '"/tmp/.mount_GitcitAbc/resources/cli/gitcito-textconv"'
    execFileSync('git', ['-C', R, 'config', '--local', 'diff.json.textconv', mount])
    expect(await gitService.repointLegacyDiffDrivers(R)).toEqual([])
    expect(git(R, 'config', '--local', 'diff.json.textconv').trim()).toBe(mount)
    expect((await gitService.diffDrivers(R)).find((d) => d.name === 'json')!.ephemeral).toBe(true)
  })
})

describe('the global config', () => {
  it('is repointed at start-up and reported once, to the first repository opened', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'githuttbr-global-textconv-'))
    try {
      const file = join(dir, 'gitconfig')
      writeFileSync(file, '')
      setEnv({ GIT_CONFIG_GLOBAL: file })
      const legacyMac = '"/Applications/Git HuttBr.app/Contents/Resources/cli/gitcito-textconv"'
      execFileSync('git', ['config', '--global', 'diff.excel.textconv', legacyMac])
      execFileSync('git', ['config', '--global', 'diff.exif.textconv', 'exiftool'])

      const atStart = await repointGlobalLegacyTextconvs()
      expect(atStart).toEqual([{ name: 'excel', previous: legacyMac, next: current(), scope: 'global' }])
      expect(execFileSync('git', ['config', '--global', 'diff.excel.textconv'], { encoding: 'utf8' }).trim()).toBe(
        current()
      )
      expect(execFileSync('git', ['config', '--global', 'diff.exif.textconv'], { encoding: 'utf8' }).trim()).toBe(
        'exiftool'
      )
      // Once per run, however often it is asked.
      expect(await repointGlobalLegacyTextconvs()).toBe(atStart)

      const first = cloneFixture('bisect-bug')
      const second = cloneFixture('bisect-bug')
      expect(await gitService.repointLegacyDiffDrivers(first)).toEqual(atStart)
      expect(await gitService.repointLegacyDiffDrivers(second)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
