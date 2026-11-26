import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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
        urls: [
          { role: 'fetch', kind: 'password', url: CLEAN_URL },
          { role: 'push', kind: 'password', url: 'https://push.example.test/team/app.git' }
        ]
      },
      { remote: 'reader', kind: 'username', urls: [{ role: 'fetch', kind: 'username', url: CLEAN_URL }] }
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

  it('rewrites several push URLs in order, cleaning only the ones with a password', async () => {
    git('remote', 'set-url', '--push', '--add', 'origin', 'https://reader@mirror.example.test/team/app.git')
    git('remote', 'set-url', '--push', '--add', 'origin', `https://x:${TOKEN}@third.example.test/team/app.git`)
    await gitService.removeRemoteUrlCredentials(repo, 'origin')
    expect(git('config', '--get-all', 'remote.origin.pushurl').split('\n')).toEqual([
      'https://push.example.test/team/app.git',
      'https://reader@mirror.example.test/team/app.git',
      'https://third.example.test/team/app.git'
    ])
    expect(configFile()).not.toContain(TOKEN)
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
