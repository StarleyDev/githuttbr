import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gitCredentialEnv, releaseCredentialEnv } from '../src/main/gitCredentialEnv'
import { gitWithInput } from './helpers'

// Real git, no network: `git credential fill` asks the configured helpers, which
// is exactly what a fetch or push does before it talks to the host.
describe('profile credential handed to git through a private endpoint', () => {
  let dir: string
  let env: NodeJS.ProcessEnv
  let storeFile: string
  const opened: NodeJS.ProcessEnv[] = []
  const credEnv = (...args: Parameters<typeof gitCredentialEnv>): NodeJS.ProcessEnv | null => {
    const e = gitCredentialEnv(...args)
    if (e) opened.push(e)
    return e
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'gitcito-credenv-'))
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

  it("answers with the profile's account, not the login the machine's helper holds", async () => {
    const extra = credEnv('https://github.com/acme/widgets.git', { username: 'oauth2', password: 'profile-pat' }, env)
    expect(extra).not.toBeNull()
    const cred = await fill(extra!, 'github.com')
    expect(cred.username).toBe('oauth2')
    expect(cred.password).toBe('profile-pat')
  })

  it('applies to that host only: another host still gets the machine helper', async () => {
    const extra = credEnv('https://github.com/acme/widgets.git', { username: 'oauth2', password: 'profile-pat' }, env)
    const cred = await fill(extra!, 'gitlab.com')
    expect(cred.password).toBe('machine-secret')
  })

  it('keeps the token out of the environment entirely and never lets a helper store it', async () => {
    const extra = credEnv('https://github.com/acme/widgets.git', { username: 'oauth2', password: 'profile-pat' }, env)!
    expect(JSON.stringify(extra)).not.toContain('profile-pat')
    expect(JSON.stringify(extra)).not.toContain('oauth2')
    // What git does after a successful push: offer the credential to every helper to keep.
    await gitWithInput(['credential', 'approve'], 'protocol=https\nhost=github.com\nusername=oauth2\npassword=profile-pat\n\n', {
      ...env,
      ...extra
    })
    expect(readFileSync(storeFile, 'utf8')).not.toContain('profile-pat')
  })

  it('keeps separate push credentials for two repositories on the same host', async () => {
    const first = credEnv('https://github.com/a/one.git', { username: 'one', password: 'first' }, env, 'repository')!
    const second = credEnv('https://github.com/b/two.git', { username: 'two', password: 'second' }, { ...env, ...first }, 'repository')!
    const both = { ...first, ...second }
    expect((await fill(both, 'github.com', 'a/one.git')).password).toBe('first')
    expect((await fill(both, 'github.com', 'b/two.git')).password).toBe('second')
    expect((await fill(both, 'github.com', 'other/repo.git')).password).toBe('machine-secret')
    await gitWithInput(
      ['credential', 'approve'],
      'protocol=https\nhost=github.com\npath=b/two.git\nusername=two\npassword=second\n\n',
      { ...env, ...both }
    )
    expect(readFileSync(storeFile, 'utf8')).not.toContain('second')
  })

  it('appends to config already passed through the environment instead of replacing it', () => {
    const extra = credEnv('https://github.com/x.git', { username: 'u', password: 'p' }, { GIT_CONFIG_COUNT: '1' })!
    expect(extra.GIT_CONFIG_COUNT).toBe('3')
    expect(extra.GIT_CONFIG_KEY_1).toBe('credential.https://github.com.helper')
    expect(extra.GIT_CONFIG_KEY_0).toBeUndefined()
  })

  it('refuses what it cannot hand over safely', () => {
    const ok = { username: 'u', password: 'p' }
    expect(credEnv('git@github.com:acme/x.git', ok)).toBeNull()
    expect(credEnv('http://github.com/acme/x.git', ok)).toBeNull()
    expect(credEnv('https://github.com/x.git', { username: 'u', password: 'p\nhost=evil' })).toBeNull()
    expect(credEnv('https://github.com/x.git', { username: 'u', password: '' })).toBeNull()
  })

  it('keeps a non-default port in the scope', () => {
    const extra = credEnv('https://git.example.com:8443/x.git', { username: 'u', password: 'p' }, {})!
    expect(extra.GIT_CONFIG_KEY_0).toBe('credential.https://git.example.com:8443.helper')
  })
})
