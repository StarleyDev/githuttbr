import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { gitService } from '../src/main/git'
import { localCiService } from '../src/main/localCi'
import { cloneFixture, cleanupFixtures } from './fixtures'
import { isPrePurgePrefix } from '../src/shared/identifiers'
import { buildStackSection, mergeStackSection } from '../src/shared/stackPr'
import { migrateLegacyStorageKeys, migratedStorageKey, type KeyValueStore } from '../src/renderer/src/lib/legacyStorage'

// The repository-level identifiers moved from `gitcito` to `githuttbr`. What
// upstream Gitcito (or this fork before the rename) left in a repository must
// keep working: new names are written, old names are still read.

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

describe('stack metadata (stacked-branches playground: one level on each key name)', () => {
  it('reads a stack whose upper level still uses gitcitoparent / gitcitobase', async () => {
    const R = cloneFixture('stacked-branches')
    // The fixture really is mixed — otherwise this proves nothing.
    expect(git(R, 'config', '--get', 'branch.feature/api.githuttbrparent')).toBe('main')
    expect(git(R, 'config', '--get', 'branch.feature/ui.gitcitoparent')).toBe('feature/api')
    const info = await gitService.stackInfo(R, 'feature/ui')
    expect(info.trunk).toBe('main')
    expect(info.branches.map((b) => [b.name, b.parent])).toEqual([
      ['feature/api', 'main'],
      ['feature/ui', 'feature/api']
    ])
    expect(await gitService.stackLeaves(R)).toEqual(['feature/ui'])
  })

  it('writes the new key, which then wins over the legacy one', async () => {
    const R = cloneFixture('stacked-branches')
    git(R, 'branch', 'feature/base', 'main')
    await gitService.stackSetParent(R, 'feature/ui', 'feature/base')
    expect(git(R, 'config', '--get', 'branch.feature/ui.githuttbrparent')).toBe('feature/base')
    // Left alone, but shadowed.
    expect(git(R, 'config', '--get', 'branch.feature/ui.gitcitoparent')).toBe('feature/api')
    const info = await gitService.stackInfo(R, 'feature/ui')
    expect(info.branches.map((b) => b.name)).toEqual(['feature/ui'])
    expect(info.trunk).toBe('feature/base')
  })

  it('untracking a level removes both key names, so the legacy link cannot come back', async () => {
    const R = cloneFixture('stacked-branches')
    await gitService.stackClearParent(R, 'feature/ui')
    expect(gitOr(R, 'config', '--get-regexp', '^branch\\.feature/ui\\.')).toBe('')
    expect((await gitService.stackInfo(R, 'feature/ui')).branches).toEqual([])
  })

  it('restacks a legacy level using its legacy base, and records the base under the new name', async () => {
    const R = cloneFixture('stacked-branches')
    await gitService.stackRestack(R, 'feature/ui')
    const info = await gitService.stackInfo(R, 'feature/ui')
    expect(info.branches.every((b) => !b.needsRestack)).toBe(true)
    expect(git(R, 'config', '--get', 'branch.feature/ui.githuttbrbase')).toBe(git(R, 'rev-parse', 'feature/api'))
  })
})

describe('protected branches', () => {
  it("falls back to gitcito.protectedbranches, and githuttbr's value wins once written", async () => {
    const R = cloneFixture('stacked-branches')
    expect(await gitService.protectedBranches(R)).toEqual(['main', 'master'])
    git(R, 'config', 'gitcito.protectedbranches', 'main,legacy')
    expect(await gitService.protectedBranches(R)).toEqual(['main', 'legacy'])
    await gitService.setProtectedBranches(R, ['main', 'release'])
    expect(git(R, 'config', '--get', 'githuttbr.protectedbranches')).toBe('main,release')
    expect(await gitService.protectedBranches(R)).toEqual(['main', 'release'])
  })
})

describe('remembered subtrees', () => {
  it('lists gitcito.subtree.* entries, prefers githuttbr.subtree.*, and forgets both', async () => {
    const R = cloneFixture('stacked-branches')
    git(R, 'config', 'gitcito.subtree.vendor%2Fold.url', 'https://example.com/old.git')
    git(R, 'config', 'gitcito.subtree.vendor%2Fold.ref', 'main')
    git(R, 'config', 'gitcito.subtree.vendor%2Fboth.url', 'https://example.com/legacy.git')
    git(R, 'config', 'githuttbr.subtree.vendor%2Fboth.url', 'https://example.com/new.git')
    const list = await gitService.subtrees(R)
    expect(list.find((s) => s.prefix === 'vendor/old')).toMatchObject({ url: 'https://example.com/old.git', ref: 'main' })
    expect(list.find((s) => s.prefix === 'vendor/both')?.url).toBe('https://example.com/new.git')

    await gitService.subtreeForget(R, 'vendor/both')
    expect(gitOr(R, 'config', '--get-regexp', 'subtree\\.vendor%2Fboth\\.')).toBe('')
  })
})

describe('WIP snapshots (snapshots playground: the guard seed is under refs/gitcito/wip)', () => {
  it('lists old and new namespaces together, newest first', async () => {
    const R = cloneFixture('snapshots')
    const list = await gitService.listSnapshots(R)
    expect(list.map((s) => s.kind)).toEqual(['guard', 'auto', 'manual'])
    expect(list[0].ref.startsWith('refs/gitcito/wip/')).toBe(true)
    expect(list[1].ref.startsWith('refs/githuttbr/wip/')).toBe(true)
  })

  it('takes new snapshots under refs/githuttbr/wip, and restores and deletes a legacy one', async () => {
    const R = cloneFixture('snapshots')
    const snap = await gitService.createSnapshot(R, 'manual')
    expect(snap?.ref.startsWith('refs/githuttbr/wip/')).toBe(true)

    const legacy = (await gitService.listSnapshots(R)).find((s) => s.ref.startsWith('refs/gitcito/wip/'))!
    git(R, 'checkout', '--', 'draft.md')
    await gitService.restoreSnapshot(R, legacy.sha, ['draft.md'])
    expect(git(R, 'show', `${legacy.sha}:draft.md`)).toContain('section three')
    await gitService.deleteSnapshot(R, legacy.ref)
    expect((await gitService.listSnapshots(R)).some((s) => s.ref === legacy.ref)).toBe(false)
  })
})

describe('history-purge backups', () => {
  it('accepts a prefix under either namespace and nothing looser', () => {
    expect(isPrePurgePrefix('refs/githuttbr/pre-purge/1795382730')).toBe(true)
    expect(isPrePurgePrefix('refs/gitcito/pre-purge/1795382730')).toBe(true)
    expect(isPrePurgePrefix('refs/gitcito/pre-purge/')).toBe(false)
    expect(isPrePurgePrefix('refs/heads/main')).toBe(false)
    expect(isPrePurgePrefix('refs/githuttbr/pre-purge/1/../../heads')).toBe(false)
  })

  it('lists, restores and drops a backup a pre-rename purge left under refs/gitcito', async () => {
    const R = cloneFixture('stacked-branches')
    const at = 1700000000
    const oldMain = git(R, 'rev-parse', 'main')
    git(R, 'update-ref', `refs/gitcito/pre-purge/${at}/heads/main`, oldMain)
    git(R, 'config', `gitcito.prepurge.at${at}`, 'secret.env')
    // Main moves on, as a purge would have moved it.
    git(R, 'checkout', '-q', 'main')
    git(R, 'commit', '-q', '--allow-empty', '-m', 'after purge')

    const backups = await gitService.historyPurgeBackups(R)
    expect(backups).toEqual([{ prefix: `refs/gitcito/pre-purge/${at}`, at, refs: 1, paths: ['secret.env'] }])

    await gitService.historyPurgeRestore(R, backups[0].prefix)
    expect(git(R, 'rev-parse', 'main')).toBe(oldMain)

    await gitService.historyPurgeDropBackup(R, backups[0].prefix)
    expect(await gitService.historyPurgeBackups(R)).toEqual([])
    expect(gitOr(R, 'config', '--get', `gitcito.prepurge.at${at}`)).toBe('')
  })
})

describe('local-CI verdicts (local-ci playground: the pass is under refs/notes/gitcito-ci)', () => {
  it('reads verdicts from both notes refs', async () => {
    const R = cloneFixture('local-ci')
    const head = git(R, 'rev-parse', 'HEAD')
    const first = git(R, 'rev-parse', 'HEAD~1')
    expect(gitOr(R, 'notes', '--ref=gitcito-ci', 'show', first)).toContain('"ok":true')
    const v = await localCiService.verdicts(R)
    expect(v[first]?.ok).toBe(true)
    expect(v[head]?.ok).toBe(false)
  })

  it('a newer githuttbr-ci note on the same commit wins over the legacy one', async () => {
    const R = cloneFixture('local-ci')
    const first = git(R, 'rev-parse', 'HEAD~1')
    git(R, 'notes', '--ref=githuttbr-ci', 'add', '-f', '-m', '{"ok":false,"workflow":"ci.yml","at":1}', first)
    expect((await localCiService.verdicts(R))[first]?.ok).toBe(false)
  })
})

describe('stacked-PR body markers', () => {
  it('writes githuttbr markers', () => {
    const section = buildStackSection([{ branch: 'a', number: 1 }], 1, 'main')
    expect(section.startsWith('<!-- githuttbr-stack -->')).toBe(true)
    expect(section.endsWith('<!-- /githuttbr-stack -->')).toBe(true)
  })

  it('replaces a section written with the legacy gitcito markers instead of adding a second one', () => {
    const body = 'Intro\n\n<!-- gitcito-stack -->\nold table\n<!-- /gitcito-stack -->\n\nOutro'
    const section = buildStackSection([{ branch: 'a', number: 1 }], 1, 'main')
    const merged = mergeStackSection(body, section)
    expect(merged).not.toContain('old table')
    expect(merged).not.toContain('gitcito-stack')
    expect(merged.startsWith('Intro')).toBe(true)
    expect(merged.endsWith('Outro')).toBe(true)
  })
})

describe('renderer localStorage keys', () => {
  const memory = (seed: Record<string, string>): KeyValueStore & { data: Map<string, string> } => {
    const data = new Map(Object.entries(seed))
    return {
      data,
      get length() {
        return data.size
      },
      key: (i) => [...data.keys()][i] ?? null,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v)
    }
  }

  it('maps only our own prefixes', () => {
    expect(migratedStorageKey('gitcito-layout')).toBe('githuttbr-layout')
    expect(migratedStorageKey('gitcito.launchDevice./repo')).toBe('githuttbr.launchDevice./repo')
    expect(migratedStorageKey('gitcito-pr-viewed:https://x/y#3')).toBe('githuttbr-pr-viewed:https://x/y#3')
    expect(migratedStorageKey('gitcitoish')).toBeNull()
    expect(migratedStorageKey('other-gitcito-key')).toBeNull()
    expect(migratedStorageKey('githuttbr-layout')).toBeNull()
  })

  it('copies legacy values once, never over a newer one, and keeps the old keys', () => {
    const store = memory({
      'gitcito-layout': '{"sidebar":200}',
      'gitcito.settings.lastPage': 'themes',
      'githuttbr.settings.lastPage': 'general',
      unrelated: 'x'
    })
    expect(migrateLegacyStorageKeys(store)).toBe(1)
    expect(store.data.get('githuttbr-layout')).toBe('{"sidebar":200}')
    expect(store.data.get('githuttbr.settings.lastPage')).toBe('general')
    expect(store.data.get('gitcito-layout')).toBe('{"sidebar":200}')
    // Idempotent: a second start copies nothing.
    expect(migrateLegacyStorageKeys(store)).toBe(0)
  })
})
