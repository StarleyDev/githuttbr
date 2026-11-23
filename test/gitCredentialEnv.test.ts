import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gitCredentialEnv as openCredentialEnv, releaseCredentialEnv } from '../src/main/gitCredentialEnv'
import { gitWithInput } from './helpers'

// Every environment opened here is released at the end, as the app does once git exits.
const opened: NodeJS.ProcessEnv[] = []
const gitCredentialEnv = (...args: Parameters<typeof openCredentialEnv>): NodeJS.ProcessEnv | null => {
  const e = openCredentialEnv(...args)
  if (e) opened.push(e)
  return e
}

// Real git, no network: `git credential fill` asks the configured helpers, which
// is exactly what a fetch or push does before it talks to the host.
describe('profile credential handed to git through a private endpoint', () => {
  let dir: string
  let env: NodeJS.ProcessEnv
  let storeFile: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'githuttbr-credenv-'))
    storeFile = join(dir, 'stored-credentials')
    writeFileSync(storeFile, 'https://machine-user:machine-secret@github.com\nhttps://machine-user:machine-secret@gitlab.com\n')
    // "The machine": a global config whose helper holds another account.
    const globalConfig = join(dir, 'gitconfig')
    writeFileSync(globalConfig, `[credential]\n\thelper = store --file=${storeFile}\n`)
    env = { PATH: process.env.PATH, HOME: dir, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' }
  })

  afterAll(() => {
    for (const e of opened) releaseCredentialEnv(e)
    rmSync(dir, { recursive: true, force: true })
  })

  const fill = async (extra: NodeJS.ProcessEnv, host: string, path = 'acme/widgets.git'): Promise<Record<string, string>> => {
    const out = await gitWithInput(['credential', 'fill'], `protocol=https\nhost=${host}\npath=${path}\n\n`, { ...env, ...extra })
    return Object.fromEntries(out.trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)))
  }

  // What git-lfs does: send the path only when `credential.<url>.useHttpPath` says so.
  const lfsFill = async (extra: NodeJS.ProcessEnv, url: string): Promise<Record<string, string>> => {
    const u = new URL(url)
    let withPath = false
    try {
      withPath =
        execFileSync('git', ['config', '--type=bool', '--get-urlmatch', 'credential.usehttppath', url], {
          env: { ...env, ...extra },
          encoding: 'utf8'
        }).trim() === 'true'
    } catch {
      withPath = false
    }
    const out = await gitWithInput(
      ['credential', 'fill'],
      `protocol=https\nhost=${u.host}\n${withPath ? `path=${u.pathname.slice(1)}\n` : ''}\n`,
      { ...env, ...extra }
    )
    return Object.fromEntries(out.trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)))
  }

  it("answers with the profile's account, not the login the machine's helper holds", async () => {
    const extra = gitCredentialEnv('https://github.com/acme/widgets.git', { username: 'oauth2', password: 'profile-pat' }, env)
    expect(extra).not.toBeNull()
    const cred = await fill(extra!, 'github.com')
    expect(cred.username).toBe('oauth2')
    expect(cred.password).toBe('profile-pat')
  })

  it('applies to that host only: another host still gets the machine helper', async () => {
    const extra = gitCredentialEnv('https://github.com/acme/widgets.git', { username: 'oauth2', password: 'profile-pat' }, env)
    const cred = await fill(extra!, 'gitlab.com')
    expect(cred.password).toBe('machine-secret')
  })

  it('keeps the token out of the environment entirely and never lets a helper store it', async () => {
    const extra = gitCredentialEnv('https://github.com/acme/widgets.git', { username: 'oauth2', password: 'profile-pat' }, env)!
    // Not in the config, and not in the environment at all: hooks inherit it.
    expect(JSON.stringify(extra)).not.toContain('profile-pat')
    expect(JSON.stringify(extra)).not.toContain('oauth2')
    // What git does after a successful push: offer the credential to every helper to keep.
    await gitWithInput(['credential', 'approve'], 'protocol=https\nhost=github.com\nusername=oauth2\npassword=profile-pat\n\n', { ...env, ...extra })
    expect(readFileSync(storeFile, 'utf8')).not.toContain('profile-pat')
  })

  it('keeps separate push credentials for two servers on the same host', async () => {
    const first = gitCredentialEnv('https://github.com/a/one.git', { username: 'one', password: 'first' }, env, {
      prefix: 'https://github.com/a'
    })!
    const second = gitCredentialEnv(
      'https://github.com/b/two.git',
      { username: 'two', password: 'second' },
      { ...env, ...first },
      { prefix: 'https://github.com/b' }
    )!
    const both = { ...first, ...second }
    expect((await fill(both, 'github.com', 'a/one.git')).password).toBe('first')
    // Anywhere under its server, as after a redirect to another spelling.
    expect((await fill(both, 'github.com', 'a/one')).password).toBe('first')
    expect((await fill(both, 'github.com', 'b/two.git')).password).toBe('second')
    expect((await fill(both, 'github.com', 'other/repo.git')).password).toBe('machine-secret')
    await gitWithInput(['credential', 'approve'], 'protocol=https\nhost=github.com\npath=b/two.git\nusername=two\npassword=second\n\n', { ...env, ...both })
    expect(readFileSync(storeFile, 'utf8')).not.toContain('second')
  })

  // A GitLab at the root and a Data Center at /bitbucket on one origin: the
  // root's token must not reach the nested server, not even when git-lfs asks.
  it('carves a nested server out of an outer one', async () => {
    const extra = gitCredentialEnv('https://github.com/group/app.git', { username: 'u', password: 'outer' }, env, {
      prefix: 'https://github.com',
      exclude: ['https://github.com/bitbucket', 'https://gitlab.com/elsewhere']
    })!
    expect((await fill(extra, 'github.com', 'group/app.git')).password).toBe('outer')
    expect((await lfsFill(extra, 'https://github.com/group/app.git/info/lfs')).password).toBe('outer')
    await expect(fill(extra, 'github.com', 'bitbucket/scm/p/r.git')).rejects.toThrow()
    await expect(lfsFill(extra, 'https://github.com/bitbucket/scm/p/r.git/info/lfs')).rejects.toThrow()
    // A repository under the nested server is not this one's to sign in to.
    expect(
      gitCredentialEnv('https://github.com/bitbucket/scm/p/r.git', { username: 'u', password: 'p' }, env, {
        prefix: 'https://github.com',
        exclude: ['https://github.com/bitbucket']
      })
    ).toBeNull()
  })

  it('a token for a base under a context path reaches git-lfs, which asks with no path otherwise', async () => {
    const extra = gitCredentialEnv('https://github.com/bitbucket/scm/p/r.git', { username: 'u', password: 'dc' }, env, {
      prefix: 'https://github.com/bitbucket'
    })!
    expect((await lfsFill(extra, 'https://github.com/bitbucket/scm/p/r.git/info/lfs')).password).toBe('dc')
  })

  it('never builds a key from what a remote path holds', async () => {
    const pwned = join(dir, 'pwned')
    const hostile = [`/o/r.helper=!touch$IFS${pwned}`, `/o/r/.helper=!touch$IFS${pwned}`, "/o/it's;$x!=y z.git", '/o/%3D%27/r.git']
    for (const path of hostile) {
      const url = `https://github.com${path}`
      for (const scope of ['host', { prefix: 'https://github.com/o' }] as const) {
        const extra = gitCredentialEnv(url, { username: 'u', password: 'p' }, env, scope)!
        const keys = Object.entries(extra).filter(([k]) => k.startsWith('GIT_CONFIG_KEY_')).map(([, v]) => v)
        const context = scope === 'host' ? 'https://github.com' : 'https://github.com/o'
        expect(keys, path).toEqual([
          `credential.${context}.helper`,
          `credential.${context}.helper`,
          `credential.${context}.useHttpPath`
        ])
        expect((await fill(extra, 'github.com', path.slice(1))).password).toBe('p')
        expect(readdirSync(dir).filter((f) => f.startsWith('pwned'))).toEqual([])
      }
    }
    // A base with characters to encode is encoded, never written raw.
    const encoded = gitCredentialEnv('https://github.com/a=b/r.git', { username: 'u', password: 'p' }, env, {
      prefix: 'https://github.com/a=b'
    })!
    expect(encoded.GIT_CONFIG_KEY_0).toBe('credential.https://github.com/a%3Db.helper')
  })

  it('appends to config already passed through the environment instead of replacing it', async () => {
    const extra = gitCredentialEnv('https://github.com/x.git', { username: 'u', password: 'p' }, { GIT_CONFIG_COUNT: '1' })!
    expect(extra.GIT_CONFIG_COUNT).toBe('4')
    expect(extra.GIT_CONFIG_KEY_1).toBe('credential.https://github.com.helper')
    expect(extra.GIT_CONFIG_KEY_0).toBeUndefined()
  })

  it('refuses what it cannot hand over safely', async () => {
    const ok = { username: 'u', password: 'p' }
    expect(gitCredentialEnv('git@github.com:acme/x.git', ok)).toBeNull()
    expect(gitCredentialEnv('http://github.com/acme/x.git', ok)).toBeNull()
    expect(gitCredentialEnv('https://github.com/x.git', { username: 'u', password: 'p\nhost=evil' })).toBeNull()
    expect(gitCredentialEnv('https://github.com/x.git', { username: 'u', password: '' })).toBeNull()
  })

  it('keeps a non-default port in the scope', async () => {
    const extra = gitCredentialEnv('https://git.example.com:8443/x.git', { username: 'u', password: 'p' }, {})!
    expect(extra.GIT_CONFIG_KEY_0).toBe('credential.https://git.example.com:8443.helper')
  })
})
