import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { APP_REPO } from '../src/shared/appRepo'

const ROOT = join(__dirname, '..')

describe('the repository this build is published from', () => {
  it('is where package.json publishes releases, so the updater looks where the builds go', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      build: { publish: { provider: string; owner: string; repo: string } }
    }
    expect(pkg.build.publish.provider).toBe('github')
    expect(`${pkg.build.publish.owner}/${pkg.build.publish.repo}`.toLowerCase()).toBe(APP_REPO.toLowerCase())
  })

  it('is the homepage the .deb advertises', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { homepage?: string }
    expect(pkg.homepage?.toLowerCase()).toBe(`https://github.com/${APP_REPO}`.toLowerCase())
  })

  it('is named only in shared/appRepo.ts', () => {
    // A copy anywhere else is the one a fork would forget to change.
    const hits: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(name) && !p.endsWith(join('shared', 'appRepo.ts'))) {
          if (readFileSync(p, 'utf8').toLowerCase().includes(APP_REPO.toLowerCase())) hits.push(p.slice(ROOT.length + 1))
        }
      }
    }
    walk(join(ROOT, 'src'))
    expect(hits).toEqual([])
  })
})
