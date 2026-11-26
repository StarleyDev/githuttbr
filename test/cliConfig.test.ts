import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSync } from 'esbuild'
import { cloneFixture, cleanupFixtures } from './fixtures'
import { findRepoConfigFile } from '../src/main/repoConfig'

/**
 * The `githuttbr` verbs that read a repository's config, run the way the shim
 * runs them: the CLI entry as plain Node. Bundled here rather than taken from
 * `out/` so the test does not depend on a prior build.
 */

let bundleDir = ''
let entry = ''

beforeAll(() => {
  bundleDir = mkdtempSync(join(tmpdir(), 'githuttbr-cli-'))
  entry = join(bundleDir, 'cliEntry.cjs')
  buildSync({
    entryPoints: [join(__dirname, '../src/main/cliEntry.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: entry,
    logLevel: 'silent'
  })
})

afterAll(() => {
  rmSync(bundleDir, { recursive: true, force: true })
  cleanupFixtures()
})

function cli(...args: string[]): { code: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [entry, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' }
  })
  return { code: r.status, stdout: r.stdout, stderr: r.stderr }
}

// What upstream Gitcito keeps in a repository. Not this app's file: never read.
const UPSTREAM = JSON.stringify({ version: 1, protect: ['legacy'], requires: { lfs: false } })

describe('findRepoConfigFile', () => {
  it("finds .githuttbr.json and ignores upstream's .gitcito.json", async () => {
    const dir = cloneFixture('project-tree')
    expect(await findRepoConfigFile(dir)).toBeNull()
    writeFileSync(join(dir, '.gitcito.json'), UPSTREAM)
    expect(await findRepoConfigFile(dir)).toBeNull()
    writeFileSync(join(dir, '.githuttbr.json'), '{"version":1}')
    expect((await findRepoConfigFile(dir))?.path).toBe(join(dir, '.githuttbr.json'))
  })
})

describe('githuttbr config / doctor on a repository with only .gitcito.json', () => {
  it('config show reports no config', () => {
    const dir = cloneFixture('project-tree')
    writeFileSync(join(dir, '.gitcito.json'), UPSTREAM)
    const r = cli('config', 'show', dir)
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('No .githuttbr.json')
    expect(r.stdout + r.stderr).not.toContain('.gitcito.json')
  })

  it('doctor does not run its requirements', () => {
    const dir = cloneFixture('project-tree')
    writeFileSync(join(dir, '.gitcito.json'), UPSTREAM)
    const r = cli('doctor', dir)
    expect(r.stdout).toContain('No requirements declared')
  })

  it('config init writes .githuttbr.json without --force and leaves .gitcito.json as it was', () => {
    const dir = cloneFixture('project-tree')
    writeFileSync(join(dir, '.gitcito.json'), UPSTREAM)
    // An .nvmrc gives init something to propose.
    writeFileSync(join(dir, '.nvmrc'), '20\n')
    const r = cli('config', 'init', dir)
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Wrote .githuttbr.json')
    expect(readFileSync(join(dir, '.gitcito.json'), 'utf8')).toBe(UPSTREAM)
  })

  it('config check on a repository with neither file says so', () => {
    const dir = cloneFixture('project-tree')
    const r = cli('config', 'check', dir)
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('no .githuttbr.json')
  })
})

describe('githuttbr doctor and an upstream Gitcito editor setting', () => {
  function cliWith(env: Record<string, string>, ...args: string[]): { code: number | null; stdout: string } {
    const r = spawnSync(process.execPath, [entry, ...args], {
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1', ...env }
    })
    return { code: r.status, stdout: r.stdout }
  }
  const gitIn = (dir: string, env: Record<string, string>, ...args: string[]): string =>
    spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } }).stdout.trim()

  it('neither reports nor rewrites `gitcito --wait`, even with --fix', () => {
    const dir = cloneFixture('project-tree')
    const globalDir = mkdtempSync(join(tmpdir(), 'githuttbr-gitconfig-'))
    const globalFile = join(globalDir, 'config')
    const globalText = '[sequence]\n\teditor = /usr/bin/gitcito --wait\n'
    writeFileSync(globalFile, globalText)
    const env = { GIT_CONFIG_GLOBAL: globalFile }
    gitIn(dir, env, 'config', '--local', 'core.editor', 'gitcito --wait')

    expect(cliWith(env, 'doctor', dir).stdout).not.toContain('gitcito')
    cliWith(env, 'doctor', dir, '--fix')
    expect(gitIn(dir, env, 'config', '--local', 'core.editor')).toBe('gitcito --wait')
    expect(readFileSync(globalFile, 'utf8')).toBe(globalText)
    rmSync(globalDir, { recursive: true, force: true })
  })
})
