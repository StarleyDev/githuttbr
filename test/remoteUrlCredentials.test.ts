import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ipcMain } from 'electron'
import { gitService, registerGitHandlers } from '../src/main/git'
import { cloneFixture, cleanupFixtures } from './fixtures'

// An old clone with a token written into its remote URL: git sends it and asks
// no helper, so the profile's token is never tried. Fictional hosts and a fake
// token only — nothing here reaches the network.
const TOKEN = 'fake-token-7f3a9c'
const USER = 'someone'
const SECRET_URL = `https://${USER}:${TOKEN}@git.example.test/team/app.git`
const CLEAN_URL = 'https://git.example.test/team/app.git'

describe('remote URLs with a saved password', () => {
  let repo: string
  const git = (...args: string[]): string => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim()
  const configFile = (): string => readFileSync(join(repo, '.git', 'config'), 'utf8')

  beforeEach(() => {
    repo = cloneFixture('multi-remote')
    for (const r of git('remote').split('\n').filter(Boolean)) git('remote', 'remove', r)
    git('remote', 'add', 'origin', SECRET_URL)
    git('remote', 'set-url', '--push', 'origin', `https://${USER}:${TOKEN}@push.example.test/team/app.git`)
    git('remote', 'add', 'reader', `https://${USER}@git.example.test/team/app.git`)
    git('remote', 'add', 'upstream', 'git@git.example.test:team/app.git')
    git('remote', 'add', 'mirror', 'ssh://git@mirror.example.test:2222/team/app.git')
  })

  afterAll(() => {
    cleanupFixtures()
  })

  it('detects which URLs carry what, without the user name or the token', async () => {
    const creds = await gitService.getRemoteUrlCredentials(repo)
    expect(creds).toEqual([
      {
        remote: 'origin',
        kind: 'password',
        removable: true,
        urls: [
          { role: 'fetch', kind: 'password', url: CLEAN_URL },
          { role: 'push', kind: 'password', url: 'https://push.example.test/team/app.git' }
        ]
      },
      { remote: 'reader', kind: 'username', removable: false, urls: [{ role: 'fetch', kind: 'username', url: CLEAN_URL }] }
    ])
    expect(JSON.stringify(creds)).not.toContain(TOKEN)
    expect(JSON.stringify(creds)).not.toContain(USER)
  })

  it('never hands the password to the renderer in the remote list', async () => {
    const remotes = await gitService.remotes(repo)
    expect(JSON.stringify(remotes)).not.toContain(TOKEN)
    const origin = remotes.find((r) => r.name === 'origin')
    expect(origin).toEqual({ name: 'origin', url: `https://${USER}@git.example.test/team/app.git`, urlCredentials: 'password' })
    expect(remotes.find((r) => r.name === 'reader')?.urlCredentials).toBe('username')
    expect(remotes.find((r) => r.name === 'upstream')?.urlCredentials).toBeUndefined()
  })

  it('removes the password from the fetch and push URLs, and leaves the rest alone', async () => {
    await gitService.removeRemoteUrlCredentials(repo, 'origin')
    expect(git('config', '--get-all', 'remote.origin.url')).toBe(CLEAN_URL)
    expect(git('config', '--get-all', 'remote.origin.pushurl')).toBe('https://push.example.test/team/app.git')
    expect(configFile()).not.toContain(TOKEN)
    // Other remotes, ssh ones included, are untouched.
    expect(git('remote', 'get-url', 'reader')).toBe(`https://${USER}@git.example.test/team/app.git`)
    expect(git('remote', 'get-url', 'upstream')).toBe('git@git.example.test:team/app.git')
    expect(git('remote', 'get-url', 'mirror')).toBe('ssh://git@mirror.example.test:2222/team/app.git')
    expect((await gitService.getRemoteUrlCredentials(repo)).map((c) => c.remote)).toEqual(['reader'])
  })

  it('rewrites several URLs in place and in order, cleaning only the ones with a password', async () => {
    git('remote', 'set-url', '--push', '--add', 'origin', 'https://reader@mirror.example.test/team/app.git')
    git('remote', 'set-url', '--push', '--add', 'origin', `https://x:${TOKEN}@third.example.test/team/app.git`)
    // Several fetch URLs too: the first one is where git fetches from, so order matters.
    git('config', '--add', 'remote.origin.url', 'https://second.example.test/team/app.git')
    git('config', '--add', 'remote.origin.url', `https://y:${TOKEN}@third.example.test/team/app.git`)
    await gitService.removeRemoteUrlCredentials(repo, 'origin')
    expect(git('config', '--get-all', 'remote.origin.url').split('\n')).toEqual([
      CLEAN_URL,
      'https://second.example.test/team/app.git',
      'https://third.example.test/team/app.git'
    ])
    expect(git('config', '--get-all', 'remote.origin.pushurl').split('\n')).toEqual([
      'https://push.example.test/team/app.git',
      'https://reader@mirror.example.test/team/app.git',
      'https://third.example.test/team/app.git'
    ])
    expect(configFile()).not.toContain(TOKEN)
  })

  it('refuses to rewrite an ambiguous URL, and its error holds no secret', async () => {
    const odd = `http://u:${TOKEN}@127.0.0.1#@evil.example.test/x`
    git('remote', 'add', 'odd', odd)
    const creds = await gitService.getRemoteUrlCredentials(repo)
    expect(creds.find((c) => c.remote === 'odd')?.removable).toBe(false)
    expect(JSON.stringify(creds)).not.toContain(TOKEN)
    const err = await gitService.removeRemoteUrlCredentials(repo, 'odd').catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toMatch(/ambiguous/)
    expect((err as Error).message).not.toContain(TOKEN)
    expect(git('remote', 'get-url', 'odd')).toBe(odd)
    const shown = (await gitService.remotes(repo)).find((r) => r.name === 'odd')
    expect(shown?.urlCredentialsAmbiguous).toBe(true)
    expect(shown?.url).not.toContain(TOKEN)
  })

  it('refuses a remote that is not configured, or reads as an option', async () => {
    await expect(gitService.removeRemoteUrlCredentials(repo, 'nope')).rejects.toThrow(/No remote named/)
    await expect(gitService.removeRemoteUrlCredentials(repo, '--upload-pack=x')).rejects.toThrow(/option/)
    expect(configFile()).toContain(TOKEN)
  })

  it('keeps the password when the edit dialog saves the URL it was shown, unchanged', async () => {
    const shown = (await gitService.remotes(repo)).find((r) => r.name === 'origin')!.url
    await gitService.editRemote(repo, 'origin', 'origin', shown)
    expect(git('remote', 'get-url', 'origin')).toBe(SECRET_URL)
    expect(git('config', '--get-all', 'remote.origin.pushurl')).toBe(`https://${USER}:${TOKEN}@push.example.test/team/app.git`)
  })

  it('a rename keeps a distinct push URL when the dialog left that field empty', async () => {
    git('remote', 'set-url', '--push', 'reader', 'https://push-only.example.test/team/app.git')
    const shown = (await gitService.remotes(repo)).find((r) => r.name === 'reader')!.url
    await gitService.editRemote(repo, 'reader', 'renamed', shown)
    expect(git('config', '--get-all', 'remote.renamed.pushurl')).toBe('https://push-only.example.test/team/app.git')
    expect(git('remote', 'get-url', 'renamed')).toBe(`https://${USER}@git.example.test/team/app.git`)
  })

  it('editing the host or path writes the URL as typed, dropping the saved password', async () => {
    await gitService.editRemote(repo, 'origin', 'origin', 'https://moved.example.test/team/app.git')
    expect(git('remote', 'get-url', 'origin')).toBe('https://moved.example.test/team/app.git')
    expect(git('config', '--get-all', 'remote.origin.url')).not.toContain(TOKEN)
  })

  it('a rename under a global insteadOf carrying a secret copies it nowhere — file or argv', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'githuttbr-insteadof-'))
    const globalConfig = join(dir, 'gitconfig')
    const trace = join(dir, 'trace.log')
    const SECRET = 'fake-insteadof-secret-91'
    writeFileSync(
      globalConfig,
      `[user]\n\tuseConfigOnly = true\n[url "https://bot:${SECRET}@rewrite.example.test/"]\n\tinsteadOf = https://rewrite.example.test/\n`
    )
    const previous = { global: process.env.GIT_CONFIG_GLOBAL, trace: process.env.GIT_TRACE }
    try {
      git('remote', 'add', 'viaRule', 'https://rewrite.example.test/team/app.git')
      process.env.GIT_CONFIG_GLOBAL = globalConfig
      process.env.GIT_TRACE = trace
      const shown = (await gitService.remotes(repo)).find((r) => r.name === 'viaRule')!
      expect(shown.url).not.toContain(SECRET)
      await gitService.editRemote(repo, 'viaRule', 'viaRuleRenamed', shown.url)
      expect(configFile()).not.toContain(SECRET)
      expect(git('config', '--get-all', 'remote.viaRuleRenamed.url')).toBe('https://rewrite.example.test/team/app.git')
      expect(() => git('config', '--get-all', 'remote.viaRuleRenamed.pushurl')).toThrow()
      // Every git command spawned during the rename, with its arguments.
      expect(existsSync(trace)).toBe(true)
      const spawned = readFileSync(trace, 'utf8')
      expect(spawned).toMatch(/remote.*rename|rename/)
      expect(spawned).not.toContain(SECRET)
    } finally {
      if (previous.global === undefined) delete process.env.GIT_CONFIG_GLOBAL
      else process.env.GIT_CONFIG_GLOBAL = previous.global
      if (previous.trace === undefined) delete process.env.GIT_TRACE
      else process.env.GIT_TRACE = previous.trace
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('lists subtrees without the password, and pulls with the remembered one', async () => {
    git('config', 'githuttbr.subtree.vendor%2Flib.url', `https://${USER}:${TOKEN}@git.example.test/lib.git`)
    git('config', 'githuttbr.subtree.vendor%2Flib.ref', 'main')
    const list = await gitService.subtrees(repo)
    const lib = list.find((x) => x.prefix === 'vendor/lib')
    expect(lib?.url).toBe(`https://${USER}@git.example.test/lib.git`)
    expect(JSON.stringify(list)).not.toContain(TOKEN)
  })

  it('reports https hosts without any userinfo', async () => {
    git('remote', 'add', 'atuser', `https://me@corp.example:ab/cd@git.example.test/repo.git`)
    const status = await gitService.credentialStatus(repo)
    expect(JSON.stringify(status.httpsHosts)).not.toContain(TOKEN)
    expect(JSON.stringify(status.httpsHosts)).not.toMatch(/ab|cd@|me@/)
    expect(status.httpsHosts).toContain('git.example.test')
    expect(status.httpsHosts).toContain('push.example.test')
  })

  it('says, as a boolean only, whether anything would answer once the password is gone', async () => {
    // No profile token and no helper for this host: the confirmation must warn.
    git('remote', 'add', 'lonely', `https://u:${TOKEN}@lonely.example.test/team/app.git`)
    expect(await gitService.remoteHasProfileCredential(repo, 'lonely')).toBe(false)
    // git's own helper answers for this host: removal leaves a way to sign in.
    git('remote', 'add', 'helped', `https://u:${TOKEN}@helped.example.test/team/app.git`)
    git('config', 'credential.https://helped.example.test.helper', '!f() { echo username=bot; echo password=from-helper; }; f')
    const yes = await gitService.remoteHasProfileCredential(repo, 'helped')
    expect(yes).toBe(true)
    expect(typeof yes).toBe('boolean')
    // Nothing with a password to remove: nothing to vouch for.
    expect(await gitService.remoteHasProfileCredential(repo, 'upstream')).toBe(false)
  })

  it('serves the detection through the IPC dispatcher as a read, with no secret in the payload', async () => {
    const spy = vi.spyOn(ipcMain, 'handle')
    registerGitHandlers()
    const handler = spy.mock.calls.find((c) => c[0] === 'git')?.[1] as
      | ((e: unknown, method: string, ...args: unknown[]) => Promise<unknown>)
      | undefined
    spy.mockRestore()
    expect(handler).toBeTypeOf('function')
    const sender = { isDestroyed: () => false, send: () => undefined }
    const result = await handler!({ sender }, 'getRemoteUrlCredentials', repo)
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    expect((result as Array<{ remote: string }>).map((c) => c.remote)).toEqual(['origin', 'reader'])
  })
})
