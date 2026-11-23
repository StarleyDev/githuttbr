import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitService, redactCredentials } from '../src/main/git'
import { redactSecrets, redactUrlUserinfo } from '../src/shared/redact'
import { cloneFolderProblem, sanitizeCloneFolder } from '../src/shared/cloneFolder'
import { cloneFolderName, cloneFolderNames } from '../src/renderer/src/lib/cloneBatch'
import { forgejoJobLogUrl } from '../src/main/forgejo'
import { azureBuildRef } from '../src/main/azurePr'
import { partitionBySecrets } from '../src/renderer/src/lib/pushBranches'
import { isSecretFile } from '../src/shared/secretFiles'
import { redactForReport } from '../src/renderer/src/lib/issueReport'

const id = ['-c', 'user.name=T', '-c', 'user.email=t@example.com']
const gitIn = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-C', cwd, ...id, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const dirs: string[] = []
const scratch = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'gitcito-sec-'))
  dirs.push(d)
  return d
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
})

/** A repository with one commit and an `origin` pointing at a local bare remote. */
function repoWithRemote(): { dir: string; repo: string } {
  const dir = scratch()
  const repo = join(dir, 'repo')
  const remote = join(dir, 'remote.git')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote])
  execFileSync('git', ['init', '-q', '-b', 'main', repo])
  writeFileSync(join(repo, 'a.txt'), '1')
  gitIn(repo, 'add', '.')
  gitIn(repo, 'commit', '-qm', 'one')
  gitIn(repo, 'remote', 'add', 'origin', remote)
  gitIn(repo, 'push', '-q', '-u', 'origin', 'main')
  return { dir, repo }
}

// The payload: run as git's upload-pack, it leaves a marker and then lets the
// real upload-pack answer, so the fetch would even look like it worked.
const payload = (marker: string): string => `--upload-pack=touch ${marker}; git-upload-pack`

describe('option injection through a URL, remote or ref', () => {
  const cwd = process.cwd()
  let ctx: { dir: string; repo: string }
  beforeEach(() => {
    ctx = repoWithRemote()
  })
  afterEach(() => process.chdir(cwd))

  it('remoteBranches never reads its URL as an option, even from inside a repository', async () => {
    const marker = join(ctx.dir, 'pwned-ls-remote')
    // The main process's cwd can be any repository: put it in one with a remote.
    process.chdir(ctx.repo)
    await expect(gitService.remoteBranches(payload(marker))).rejects.toThrow()
    expect(existsSync(marker)).toBe(false)
  })

  it('a fetch never reads its remote or its ref as an option', async () => {
    const m1 = join(ctx.dir, 'pwned-fetch')
    await expect(gitService.fetchRemote(ctx.repo, payload(m1))).rejects.toThrow()
    expect(existsSync(m1)).toBe(false)

    const m2 = join(ctx.dir, 'pwned-preview')
    await expect(gitService.previewRef(ctx.repo, 'origin', payload(m2), 'merge')).rejects.toThrow()
    expect(existsSync(m2)).toBe(false)

    const m3 = join(ctx.dir, 'pwned-checkout-remote')
    await gitService.checkoutRemote(ctx.repo, 'origin/main', payload(m3), 'origin').catch(() => undefined)
    expect(existsSync(m3)).toBe(false)
  })

  it('every network call refuses an option-shaped remote', async () => {
    const m = join(ctx.dir, 'pwned-any')
    const p = payload(m)
    await expect(gitService.pushAllTags(ctx.repo, p)).rejects.toThrow(/Refusing/)
    await expect(gitService.fetchNotes(ctx.repo, p)).rejects.toThrow(/Refusing/)
    await expect(gitService.getRemoteTags(ctx.repo, p)).resolves.toEqual([])
    await expect(gitService.remoteHasBranches(ctx.repo, p, ['main'])).resolves.toEqual([])
    await expect(gitService.subtreeAdd(ctx.repo, 'vendor', p, 'main')).rejects.toThrow(/Refusing/)
    await expect(gitService.addRemote(ctx.repo, 'evil', p)).rejects.toThrow(/Refusing/)
    expect(existsSync(m)).toBe(false)
  })

  it('a clone refuses an option-shaped URL or folder', async () => {
    const parent = scratch()
    await expect(gitService.clone(parent, payload(join(parent, 'm')), 'x')).rejects.toThrow(/Refusing/)
    await expect(gitService.clone(parent, join(ctx.dir, 'remote.git'), '--config=core.x=1')).rejects.toThrow(/Refusing/)
    expect(readdirSync(parent)).toEqual([])
  })

  it('still lists and fetches normally', async () => {
    process.chdir(tmpdir())
    expect(await gitService.remoteBranches(join(ctx.dir, 'remote.git'))).toEqual(['main'])
    await gitService.fetchRemote(ctx.repo, 'origin')
    expect(await gitService.remoteHasBranches(ctx.repo, 'origin', ['main', 'nope'])).toEqual(['main'])
  })
})

describe('credential redaction', () => {
  const SECRET_URL = 'https://x-token-auth:BBDCab+/cdSECRET@127.0.0.1:9/scm/x.git'

  it('redacts a token holding "/" from real git stderr', async () => {
    const err = await gitService.remoteBranches(SECRET_URL).then(
      () => null,
      (e: Error) => e
    )
    expect(err).toBeInstanceOf(Error)
    expect(err!.message).not.toMatch(/SECRET|BBDCab/)
    expect(err!.message).toContain('https://***@127.0.0.1:9/scm/x.git')
  })

  it('takes userinfo up to the last @ before the URL ends', () => {
    expect(redactCredentials(`fatal: unable to access '${SECRET_URL}/': nope`)).toBe(
      "fatal: unable to access 'https://***@127.0.0.1:9/scm/x.git/': nope"
    )
    expect(redactCredentials('https://u:p@ss/w@rd@host/r.git and https://other.example/x')).toBe(
      'https://***@host/r.git and https://other.example/x'
    )
    expect(redactCredentials('https://host/repo.git stays')).toBe('https://host/repo.git stays')
    expect(redactUrlUserinfo(`see <${SECRET_URL}>`, '')).toBe('see <https://127.0.0.1:9/scm/x.git>')
  })

  it('redacts bare token shapes', () => {
    const tokens = [
      'ghp_' + 'a'.repeat(36),
      'github_pat_' + 'A1_'.repeat(10),
      'glpat-' + 'x'.repeat(20),
      'gldt-' + 'x'.repeat(20),
      'glptt-' + 'x'.repeat(20),
      'ATATT3xFfGF0' + 'Zz9+/'.repeat(8),
      'BBDC-' + 'Mz+/'.repeat(8)
    ]
    for (const tok of tokens) {
      const out = redactSecrets(`token ${tok} rejected`)
      expect(out, tok).toBe('token *** rejected')
    }
    expect(redactSecrets('helper said x-token-auth:abc+/def')).toBe('helper said x-token-auth:***')
  })

  it('the bug-report redaction drops the whole userinfo too', () => {
    expect(redactForReport(`clone ${SECRET_URL} failed`)).not.toMatch(/SECRET|BBDC|x-token-auth/)
  })
})

describe('CI log URLs carry the token only to their own instance', () => {
  it('refuses a dot-dot owner or repository, encoded or not', () => {
    const base = 'https://h.example/forgejo'
    for (const target of [
      `${base}/../evilapp/actions/runs/1/jobs/1`,
      `${base}/%2e%2e/evilapp/actions/runs/1/jobs/1`,
      `${base}/owner/../actions/runs/1/jobs/1`,
      `${base}/owner/%2E%2E/actions/runs/1/jobs/1`,
      `${base}/./repo/actions/runs/1/jobs/1`,
      `${base}/o%2fx/repo/actions/runs/1/jobs/1`
    ]) {
      expect(forgejoJobLogUrl(base, target), target).toBeNull()
    }
    expect(forgejoJobLogUrl(base, `${base}/o.k/re-po_1/actions/runs/1/jobs/2`)).toBe(
      `${base}/o.k/re-po_1/actions/runs/1/jobs/2/logs`
    )
  })

  it('refuses an Azure build link whose project would walk out of the organization', () => {
    expect(azureBuildRef('acme', 'https://dev.azure.com/acme/%252e%252e/_build/results?buildId=3')).not.toBeNull()
    expect(azureBuildRef('acme', 'https://acme.visualstudio.com/%2e%2e/_build/results?buildId=3')).toBeNull()
    expect(azureBuildRef('acme', 'https://dev.azure.com/acme/a%2Fb/_build/results?buildId=3')).toBeNull()
    expect(azureBuildRef('acme', 'https://dev.azure.com/acme/web/_build/results?buildId=3')).toEqual({
      project: 'web',
      buildId: 3
    })
  })
})

describe('the multi-branch push secret guard fails closed', () => {
  it('holds a branch whose outgoing files could not be listed', async () => {
    const { repo } = repoWithRemote()
    gitIn(repo, 'checkout', '-q', '-b', 'fresh')
    gitIn(repo, 'commit', '-q', '--allow-empty', '-m', 'f')
    // `ghost` does not exist: neither the log nor the tip fallback can list it.
    const files = await gitService.outgoingFiles(repo, 'origin', ['fresh', 'ghost', '--all'])
    expect(files.fresh).toEqual([])
    const { clean, flagged } = partitionBySecrets(['fresh', 'ghost', '--all'], files, isSecretFile)
    expect(clean).toEqual(['fresh'])
    expect(flagged).toEqual([
      { branch: 'ghost', files: [], unchecked: true },
      { branch: '--all', files: [], unchecked: true }
    ])
  })

  it('treats a missing entry as unchecked, never as clean', () => {
    expect(partitionBySecrets(['a'], {}, isSecretFile)).toEqual({
      clean: [],
      flagged: [{ branch: 'a', files: [], unchecked: true }]
    })
  })
})

describe('clone folder names from server data', () => {
  it('main refuses a name that escapes, names a device or reads as an option', async () => {
    const { dir } = repoWithRemote()
    const parent = join(dir, 'parent')
    mkdirSync(parent)
    expect(cloneFolderProblem('x ')).not.toBeNull()
    const bad = ['..\\..\\x', '../x', 'a/b', '..', 'CON', 'nul.txt', 'Com1', 'lpt9.git', 'C:x', '-x', '.hidden', 'x.', 'a\0b']
    for (const name of bad) {
      expect(cloneFolderProblem(name), name).not.toBeNull()
      await expect(gitService.clone(parent, join(dir, 'remote.git'), name), name).rejects.toThrow(/Refusing/)
    }
    expect(readdirSync(parent)).toEqual([])
    expect(readdirSync(dir).sort()).toEqual(['parent', 'remote.git', 'repo'])
    await gitService.clone(parent, join(dir, 'remote.git'), 'fine.name')
    expect(readdirSync(parent)).toEqual(['fine.name'])
  })

  it('the batch UI shows only names main will accept', () => {
    expect(cloneFolderName('..\\..\\x')).toBe('x')
    expect(cloneFolderName('owner/CON')).toBe('CON_')
    expect(cloneFolderName('owner/..')).toBe('owner')
    expect(cloneFolderName('..')).toBe('repository')
    expect(cloneFolderName('owner/-rf')).toBe('rf')
    expect(cloneFolderName('owner/app.git')).toBe('app')
    expect(sanitizeCloneFolder('nul.txt')).toBe('nul_.txt')
    expect(cloneFolderNames(['a/..\\evil', 'b/..\\evil'])).toEqual(['a-evil', 'b-evil'])
    for (const n of cloneFolderNames(['x/..\\..\\y', 'o/AUX', 'o/.git', 'g/sub/tools'])) {
      expect(cloneFolderProblem(n), n).toBeNull()
    }
  })
})
