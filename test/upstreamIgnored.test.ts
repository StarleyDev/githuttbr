import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitService } from '../src/main/git'
import { localCiService } from '../src/main/localCi'
import { readRepoConfig, writeRepoConfig } from '../src/main/repoConfig'
import * as identity from '../src/main/appIdentity'
import { isPrePurgePrefix } from '../src/shared/identifiers'
import { buildStackSection, mergeStackSection } from '../src/shared/stackPr'
import { cloneFixture, cleanupFixtures } from './fixtures'
import { ROOT } from './helpers'

// GitHuttBr and upstream Gitcito are separate apps that can live on the same
// machine and open the same repositories. What Gitcito keeps there, under its
// own `gitcito` name, is Gitcito's: this app neither reads it nor rewrites nor
// deletes it. Each test plants upstream's data, drives the feature, and checks
// the data is ignored and still exactly as it was.

afterAll(cleanupFixtures)

const git = (dir: string, ...args: string[]): string =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim()
const gitOr = (dir: string, ...args: string[]): string => {
  try {
    return git(dir, ...args)
  } catch {
    return ''
  }
}

describe('stack metadata: branch.<name>.gitcitoparent / gitcitobase', () => {
  it('is not a stack, and clearing a level leaves the upstream keys', async () => {
    const R = cloneFixture('stacked-branches')
    git(R, 'branch', 'upstream-level', 'main')
    git(R, 'config', 'branch.upstream-level.gitcitoparent', 'main')
    git(R, 'config', 'branch.upstream-level.gitcitobase', git(R, 'rev-parse', 'main'))
    expect((await gitService.stackInfo(R, 'upstream-level')).branches).toEqual([])
    expect(await gitService.stackLeaves(R)).not.toContain('upstream-level')

    await gitService.stackClearParent(R, 'upstream-level')
    expect(git(R, 'config', '--get', 'branch.upstream-level.gitcitoparent')).toBe('main')
    expect(gitOr(R, 'config', '--get', 'branch.upstream-level.gitcitobase')).not.toBe('')
  })
})

describe('protected branches: gitcito.protectedbranches', () => {
  it('is not read, and setting ours does not touch it', async () => {
    const R = cloneFixture('stacked-branches')
    git(R, 'config', 'gitcito.protectedbranches', 'main,upstream-only')
    expect(await gitService.protectedBranches(R)).toEqual(['main', 'master'])
    await gitService.setProtectedBranches(R, ['main', 'release'])
    expect(await gitService.protectedBranches(R)).toEqual(['main', 'release'])
    expect(git(R, 'config', '--get', 'gitcito.protectedbranches')).toBe('main,upstream-only')
  })
})

describe('remembered subtrees: gitcito.subtree.*', () => {
  it('is not listed, and forgetting a subtree leaves it', async () => {
    const R = cloneFixture('stacked-branches')
    git(R, 'config', 'gitcito.subtree.vendor%2Fold.url', 'https://example.com/old.git')
    git(R, 'config', 'githuttbr.subtree.vendor%2Fold.url', 'https://example.com/ours.git')
    const list = await gitService.subtrees(R)
    expect(list.find((s) => s.prefix === 'vendor/old')?.url).toBe('https://example.com/ours.git')

    await gitService.subtreeForget(R, 'vendor/old')
    expect(gitOr(R, 'config', '--get', 'githuttbr.subtree.vendor%2Fold.url')).toBe('')
    expect(git(R, 'config', '--get', 'gitcito.subtree.vendor%2Fold.url')).toBe('https://example.com/old.git')
  })
})

describe('WIP snapshots: refs/gitcito/wip', () => {
  it('is not listed, not pruned, and cannot be deleted through the app', async () => {
    const R = cloneFixture('snapshots')
    const ref = 'refs/gitcito/wip/1700000000-g'
    git(R, 'update-ref', ref, git(R, 'rev-parse', 'HEAD'))
    const list = await gitService.listSnapshots(R)
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((s) => s.ref.startsWith('refs/githuttbr/wip/'))).toBe(true)

    // Taking a snapshot prunes beyond the cap; a cap of one prunes everything else of ours.
    await gitService.createSnapshot(R, 'manual', 1)
    expect((await gitService.listSnapshots(R)).length).toBe(1)
    await expect(gitService.deleteSnapshot(R, ref)).rejects.toThrow()
    expect(git(R, 'rev-parse', '--verify', ref)).toBe(git(R, 'rev-parse', 'HEAD~0'))
  })
})

describe('history-purge backups: refs/gitcito/pre-purge', () => {
  it('only refs/githuttbr/pre-purge/<seconds> is a backup prefix', () => {
    expect(isPrePurgePrefix('refs/githuttbr/pre-purge/1795382730')).toBe(true)
    expect(isPrePurgePrefix('refs/gitcito/pre-purge/1795382730')).toBe(false)
    expect(isPrePurgePrefix('refs/heads/main')).toBe(false)
    expect(isPrePurgePrefix('refs/githuttbr/pre-purge/1/../../heads')).toBe(false)
  })

  it('is not listed, restored or dropped', async () => {
    const R = cloneFixture('stacked-branches')
    const at = 1700000000
    const prefix = `refs/gitcito/pre-purge/${at}`
    const oldMain = git(R, 'rev-parse', 'main')
    git(R, 'update-ref', `${prefix}/heads/main`, oldMain)
    git(R, 'config', `gitcito.prepurge.at${at}`, 'secret.env')
    git(R, 'checkout', '-q', 'main')
    git(R, 'commit', '-q', '--allow-empty', '-m', 'after an upstream purge')
    const newMain = git(R, 'rev-parse', 'main')

    expect(await gitService.historyPurgeBackups(R)).toEqual([])
    await expect(gitService.historyPurgeRestore(R, prefix)).rejects.toThrow()
    await expect(gitService.historyPurgeDropBackup(R, prefix)).rejects.toThrow()
    expect(git(R, 'rev-parse', 'main')).toBe(newMain)
    expect(git(R, 'rev-parse', `${prefix}/heads/main`)).toBe(oldMain)
    expect(git(R, 'config', '--get', `gitcito.prepurge.at${at}`)).toBe('secret.env')
  })
})

describe('local-CI verdicts: refs/notes/gitcito-ci', () => {
  it('is not read', async () => {
    const R = cloneFixture('local-ci')
    const first = git(R, 'rev-parse', 'HEAD~1')
    git(R, 'notes', '--ref=gitcito-ci', 'add', '-f', '-m', '{"ok":false,"workflow":"x.yml","at":1}', 'HEAD')
    const v = await localCiService.verdicts(R)
    // The fixture's own verdicts, under githuttbr-ci, and nothing else.
    expect(v[first]?.ok).toBe(true)
    expect(v[git(R, 'rev-parse', 'HEAD')]?.workflow).toBe('ci.yml')
    expect(gitOr(R, 'notes', '--ref=gitcito-ci', 'show', 'HEAD')).toContain('x.yml')
  })
})

describe('stacked-PR body markers: <!-- gitcito-stack -->', () => {
  it('a section between upstream markers is left alone, and ours is added after it', () => {
    const body = 'Intro\n\n<!-- gitcito-stack -->\nupstream table\n<!-- /gitcito-stack -->'
    const section = buildStackSection([{ branch: 'a', number: 1 }], 1, 'main')
    const merged = mergeStackSection(body, section)
    expect(merged.startsWith(body)).toBe(true)
    expect(merged.endsWith('<!-- /githuttbr-stack -->')).toBe(true)
  })
})

describe('repository config: .gitcito.json', () => {
  it('is not read, and saving ours leaves it as it was', async () => {
    const R = cloneFixture('project-tree')
    const upstream = JSON.stringify({ version: 1, protect: ['upstream-only'] })
    writeFileSync(join(R, '.gitcito.json'), upstream)
    expect((await readRepoConfig(R)).exists).toBe(false)
    await writeRepoConfig(R, { version: 1, protect: ['main'] })
    expect((await readRepoConfig(R)).config?.protect).toEqual(['main'])
    expect(readFileSync(join(R, '.gitcito.json'), 'utf8')).toBe(upstream)
  })
})


describe("upstream Gitcito's settings folder (~/.config/Gitcito and its peers)", () => {
  // Nothing to drive: the code that copied it on first start is gone. Pin that
  // nothing in the main process names the folder or its files any more.
  it('no main-process module reads it', () => {
    expect(Object.keys(identity).filter((k) => k.startsWith('LEGACY'))).toEqual([])
    expect(existsSync(join(ROOT, 'src/main/legacyMigration.ts'))).toBe(false)
    for (const f of readdirSync(join(ROOT, 'src/main')).filter((n) => n.endsWith('.ts'))) {
      const src = readFileSync(join(ROOT, 'src/main', f), 'utf8')
      expect(src, f).not.toMatch(/['"`]Gitcito['"`]/)
      expect(src, f).not.toMatch(/['"`]gitcito-(settings|secrets|vault|keychain)/)
    }
  })
})
