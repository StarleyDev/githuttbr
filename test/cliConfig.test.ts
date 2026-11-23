import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

const LEGACY = JSON.stringify({ version: 1, protect: ['legacy'], requires: { lfs: false } })

describe('findRepoConfigFile', () => {
  it('finds the new file first, then the legacy one, else nothing', async () => {
    const dir = cloneFixture('project-tree')
    expect(await findRepoConfigFile(dir)).toBeNull()
    writeFileSync(join(dir, '.gitcito.json'), LEGACY)
    expect(await findRepoConfigFile(dir)).toEqual({ path: join(dir, '.gitcito.json'), raw: LEGACY })
    writeFileSync(join(dir, '.githuttbr.json'), '{"version":1}')
    expect((await findRepoConfigFile(dir))?.path).toBe(join(dir, '.githuttbr.json'))
  })
})

describe('githuttbr config / doctor on a repository with only .gitcito.json', () => {
  it('config show prints the legacy file and names it', () => {
    const dir = cloneFixture('project-tree')
    writeFileSync(join(dir, '.gitcito.json'), LEGACY)
    const r = cli('config', 'show', dir)
    expect(r.code).toBe(0)
    expect(r.stdout.trim()).toBe(LEGACY)
    expect(r.stderr).toContain('.gitcito.json')
  })

  it('config check validates the legacy file under its own name', () => {
    const dir = cloneFixture('project-tree')
    writeFileSync(join(dir, '.gitcito.json'), LEGACY)
    const r = cli('config', 'check', dir)
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('.gitcito.json is valid.')
  })

  it('doctor runs the legacy requirements and names the file', () => {
    const dir = cloneFixture('project-tree')
    writeFileSync(join(dir, '.gitcito.json'), LEGACY)
    const r = cli('doctor', dir)
    expect(r.stdout).toContain('(.gitcito.json)')
    expect(r.stdout).not.toContain('No requirements declared')
  })

  it('config init will not shadow the legacy file without --force, and then writes the new one', () => {
    const dir = cloneFixture('project-tree')
    writeFileSync(join(dir, '.gitcito.json'), LEGACY)
    // An .nvmrc gives init something to propose.
    writeFileSync(join(dir, '.nvmrc'), '20\n')
    const refused = cli('config', 'init', dir)
    expect(refused.code).toBe(2)
    expect(refused.stderr).toContain('.gitcito.json already exists')
    expect(existsSync(join(dir, '.githuttbr.json'))).toBe(false)

    const forced = cli('config', 'init', dir, '--force')
    expect(forced.code).toBe(0)
    expect(forced.stdout).toContain('Wrote .githuttbr.json')
    expect(existsSync(join(dir, '.githuttbr.json'))).toBe(true)
    expect(readFileSync(join(dir, '.gitcito.json'), 'utf8')).toBe(LEGACY)
  })

  it('config check on a repository with neither file says so', () => {
    const dir = cloneFixture('project-tree')
    const r = cli('config', 'check', dir)
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('no .githuttbr.json')
  })
})
