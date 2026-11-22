import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error — a plain .mjs script, untyped on purpose
import { productionPackages } from '../scripts/gen-licenses.mjs'
import { ROOT } from './helpers'

type Pkg = { path: string; optional: boolean }

describe('the licence list’s package set', () => {
  it('takes every lockfile entry not flagged dev, hoisted before nested', () => {
    const lock = {
      packages: {
        '': { name: 'app' },
        'node_modules/zed': {},
        'node_modules/echarts/node_modules/tslib': {},
        'node_modules/tslib': {},
        'node_modules/vitest': { dev: true },
        'node_modules/fsevents': { dev: true, optional: true },
        'node_modules/node-pty': { optional: true },
        'node_modules/csstype': { devOptional: true },
        'packages/local': {}
      }
    }
    expect(productionPackages(lock)).toEqual([
      { path: 'node_modules/csstype', optional: true },
      { path: 'node_modules/node-pty', optional: true },
      { path: 'node_modules/tslib', optional: false },
      { path: 'node_modules/zed', optional: false },
      { path: 'node_modules/echarts/node_modules/tslib', optional: false }
    ])
  })

  it('refuses a lockfile without a packages map', () => {
    expect(() => productionPackages({ lockfileVersion: 1, dependencies: {} })).toThrow(/packages/)
  })

  it('covers every production dependency the real lockfile lists', () => {
    const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'))
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const paths = new Set((productionPackages(lock) as Pkg[]).map((p) => p.path))
    for (const dep of Object.keys(manifest.dependencies)) expect(paths).toContain(`node_modules/${dep}`)
    expect(paths).not.toContain('node_modules/vitest')
  })
})

describe('gen-licenses against a broken install', () => {
  const dirs: string[] = []
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

  // The script resolves everything relative to its own location, so a copy in
  // a temp tree runs against that tree's (empty) node_modules.
  it('exits nonzero and writes nothing instead of a shrunken list', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gitcito-licenses-'))
    dirs.push(dir)
    mkdirSync(join(dir, 'scripts'))
    mkdirSync(join(dir, 'src/renderer/src'), { recursive: true })
    mkdirSync(join(dir, 'node_modules/electron'), { recursive: true })
    copyFileSync(join(ROOT, 'scripts/gen-licenses.mjs'), join(dir, 'scripts/gen-licenses.mjs'))
    writeFileSync(join(dir, 'node_modules/electron/package.json'), '{"name":"electron","version":"1.0.0"}')
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', dependencies: { left: '1' } }))
    writeFileSync(
      join(dir, 'package-lock.json'),
      JSON.stringify({ lockfileVersion: 3, packages: { '': {}, 'node_modules/left': { version: '1.0.0' } } })
    )
    const run = spawnSync(process.execPath, [join(dir, 'scripts/gen-licenses.mjs')], { encoding: 'utf8' })
    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/node_modules\/left/)
    expect(existsSync(join(dir, 'src/renderer/src/licenses.generated.json'))).toBe(false)
  })
})
