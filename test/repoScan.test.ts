import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanForRepos } from '../src/main/repoScan'

const roots: string[] = []

/** A tree of fake repos: a .git directory is all the scanner looks for. */
function tree(): string {
  const root = mkdtempSync(join(tmpdir(), 'githuttbr-scan-'))
  roots.push(root)
  const repo = (rel: string): void => {
    mkdirSync(join(root, rel, '.git'), { recursive: true })
    writeFileSync(join(root, rel, '.git', 'HEAD'), 'ref: refs/heads/main\n')
  }
  repo('alpha')
  repo('client/beta')
  repo('client/gamma')
  repo('too/deep/for/us/delta')
  repo('alpha/vendor/nested')
  repo('node_modules/evil')
  mkdirSync(join(root, 'plain-folder'), { recursive: true })
  return root
}

afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true })
})

describe('scanForRepos', () => {
  it('finds repos down to the given depth', async () => {
    const root = tree()
    const found = await scanForRepos(root, 3)
    expect(found).toContain(join(root, 'alpha'))
    expect(found).toContain(join(root, 'client', 'beta'))
    expect(found).toContain(join(root, 'client', 'gamma'))
  })

  it('does not descend past the depth limit', async () => {
    const root = tree()
    const found = await scanForRepos(root, 3)
    expect(found).not.toContain(join(root, 'too', 'deep', 'for', 'us', 'delta'))
  })

  it('stops at a repository rather than walking into it', async () => {
    const root = tree()
    const found = await scanForRepos(root, 5)
    expect(found).not.toContain(join(root, 'alpha', 'vendor', 'nested'))
  })

  it('skips node_modules', async () => {
    const root = tree()
    const found = await scanForRepos(root, 5)
    expect(found).not.toContain(join(root, 'node_modules', 'evil'))
  })

  it('follows a symlinked folder, reporting what it finds by real path', async () => {
    const root = tree()
    const links = mkdtempSync(join(tmpdir(), 'githuttbr-scan-links-'))
    roots.push(links)
    symlinkSync(join(root, 'alpha'), join(links, 'alpha-link'))
    symlinkSync(join(root, 'client'), join(links, 'client-link'))
    symlinkSync(join(root, 'missing'), join(links, 'dangling'))
    const found = await scanForRepos(links, 2)
    // The real path, not the link: the same repository opened from the picker
    // must be the same entry, the same tab and the same git lock.
    const real = (p: string): string => realpathSync(join(root, p))
    expect(found.sort()).toEqual([real('alpha'), real('client/beta'), real('client/gamma')].sort())
  })

  it('keeps the spelling of a plain folder, even under a linked root', async () => {
    const root = tree()
    const links = mkdtempSync(join(tmpdir(), 'githuttbr-scan-links-'))
    roots.push(links)
    symlinkSync(root, join(links, 'root-link'))
    // The root as the user picked it — through a link — is not rewritten.
    const found = await scanForRepos(join(links, 'root-link'), 3)
    expect(found).toContain(join(links, 'root-link', 'alpha'))
  })

  it('walks each real folder once, so a link back up the tree cannot loop', async () => {
    const root = tree()
    symlinkSync(root, join(root, 'client', 'up'))
    symlinkSync(join(root, 'alpha'), join(root, 'alpha-again'))
    const found = await scanForRepos(root, 10)
    expect(found.filter((p) => p.endsWith('beta'))).toHaveLength(1)
    // Two ways into one repository list it once.
    expect(found.filter((p) => p.endsWith('alpha') || p.endsWith('alpha-again'))).toHaveLength(1)
  })

  it('returns nothing for a root that does not exist', async () => {
    expect(await scanForRepos('/definitely/not/here', 3)).toEqual([])
  })
})
