import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  anonymousGitEnv,
  canonicalUrlHost,
  gitCredentialEnv as openCredentialEnv,
  gitMatchesCredentialUrlPrefix,
  parseConfigParameters,
  releaseCredentialEnv
} from '../src/main/gitCredentialEnv'
import { requestInScope } from '../src/main/credentialBroker'
import { ambiguousRemotePath } from '../src/shared/remotePath'
import { resolveRemoteProvider } from '../src/shared/remoteProvider'
import { githubBaseOfRemote, githubInstanceOf, GITHUB_COM } from '../src/shared/githubEnterprise'
import { bitbucketBaseOfRemote } from '../src/shared/bitbucketServer'
import { gitWithInput } from './helpers'

// The edges of the credential broker a red-team found: an inherited `git -c`
// helper, git older than 2.26, host spellings git and WHATWG read differently,
// a nested server reached through a path a proxy routes differently, and the
// `%` and `:443` spellings that locked a profile out. Real git, no network:
// `git credential fill` / `approve` ask the configured helpers exactly as a
// fetch or push does.

const opened: NodeJS.ProcessEnv[] = []
const gitCredentialEnv = (...args: Parameters<typeof openCredentialEnv>): NodeJS.ProcessEnv | null => {
  const e = openCredentialEnv(...args)
  if (e) opened.push(e)
  return e
}

const dir = mkdtempSync(join(tmpdir(), 'gitcito-cred-edges-'))
const log = join(dir, 'helper.log')
const logger = join(dir, 'logger.sh')
const machine = join(dir, 'machine.sh')
let env: NodeJS.ProcessEnv

beforeAll(() => {
  // Writes every call it gets — action and request — and answers nothing.
  writeFileSync(logger, `#!/bin/sh\necho "$1 $(cat | tr '\\n' ' ')" >> '${log}'\nexit 0\n`)
  chmodSync(logger, 0o755)
  // "The machine": a global helper holding another account's login.
  writeFileSync(machine, `#!/bin/sh\ntest "$1" = get && printf 'username=machine-user\\npassword=machine-secret\\n'\nexit 0\n`)
  chmodSync(machine, 0o755)
  writeFileSync(join(dir, 'gitconfig'), `[credential]\n\thelper = ${machine}\n`)
  writeFileSync(join(dir, 'included.cfg'), `[credential]\n\thelper = ${logger}\n`)
  env = {
    PATH: process.env.PATH,
    HOME: dir,
    GIT_CONFIG_GLOBAL: join(dir, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0'
  }
})

afterAll(() => {
  for (const e of opened) releaseCredentialEnv(e)
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => rmSync(log, { force: true }))

const logged = (): string => (existsSync(log) ? readFileSync(log, 'utf8') : '')

async function fill(extra: NodeJS.ProcessEnv, url: string, base = env): Promise<string | null> {
  try {
    const out = await gitWithInput(['credential', 'fill'], `url=${url}\n\n`, { ...base, ...extra })
    return /^password=(.*)$/m.exec(out)?.[1] ?? null
  } catch {
    return null
  }
}

describe('F1: a credential helper inherited through GIT_CONFIG_PARAMETERS', () => {
  const forms = [
    ['old form', `'credential.helper=${logger}'`],
    ['new form', `'credential.helper'='${logger}'`],
    ['url-scoped', `'credential.https://h.example.helper=${logger}'`],
    ['mixed case', `'Credential.Helper=${logger}'`],
    ['through an include', `'include.path=${join(dir, 'included.cfg')}'`]
  ] as const

  for (const [name, params] of forms) {
    it(`never stores the profile's token, nor answers for it (${name})`, async () => {
      const base = { ...env, GIT_CONFIG_PARAMETERS: params }
      const extra = gitCredentialEnv('https://h.example/g/r.git', { username: 'u', password: 'TOKEN' }, base)!
      expect(await fill(extra, 'https://h.example/g/r.git', base)).toBe('TOKEN')
      // What git does after a successful push: offer the pair to every helper to keep.
      await gitWithInput(
        ['credential', 'approve'],
        'protocol=https\nhost=h.example\npath=g/r.git\nusername=u\npassword=TOKEN\n\n',
        { ...base, ...extra }
      )
      expect(logged()).not.toMatch(/store|get/)
    })

    it(`asking as nobody, the inherited helper is not asked either (${name})`, async () => {
      const base = { ...env, GIT_CONFIG_PARAMETERS: params }
      for (const configCount of [true, false]) {
        const extra = anonymousGitEnv('https://h.example/g/r.git', base, 'host', { configCount })!
        expect(await fill(extra, 'https://h.example/g/r.git', base)).toBeNull()
      }
      expect(logged()).toBe('')
    })
  }

  it('keeps every other inherited entry, and drops a value it cannot read whole', () => {
    const base = { ...env, GIT_CONFIG_PARAMETERS: `'core.pager=less -R' 'credential.helper=x' 'user.name'='A '\\'' B'` }
    const extra = gitCredentialEnv('https://h.example/g/r.git', { username: 'u', password: 'p' }, base)!
    expect(extra.GIT_CONFIG_PARAMETERS).toBe(`'core.pager=less -R' 'user.name'='A '\\'' B'`)
    const broken = gitCredentialEnv('https://h.example/g/r.git', { username: 'u', password: 'p' }, {
      GIT_CONFIG_PARAMETERS: `'credential.helper=x`
    })!
    expect(broken.GIT_CONFIG_PARAMETERS).toBe('')
    // None inherited: none added.
    expect('GIT_CONFIG_PARAMETERS' in gitCredentialEnv('https://h.example/g/r.git', { username: 'u', password: 'p' }, {})!).toBe(false)
  })

  it("reads GIT_CONFIG_PARAMETERS the way git's sq_dequote does", () => {
    expect(parseConfigParameters(`'a.b=c' 'd.e'='f g' 'h.i'= 'j.k'`)?.map((e) => e.key)).toEqual(['a.b', 'd.e', 'h.i', 'j.k'])
    expect(parseConfigParameters(`'a.b=it'\\''s'`)?.map((e) => e.key)).toEqual(['a.b'])
    expect(parseConfigParameters(`a.b=c`)).toBeNull()
    expect(parseConfigParameters(`'a.b=c'x`)).toBeNull()
    expect(parseConfigParameters('')).toEqual([])
  })

  // Global and system config are read before any config from the environment:
  // the empty entry clears them already.
  it("a helper in the global config is overridden too: the profile's account answers", async () => {
    const extra = gitCredentialEnv('https://h.example/g/r.git', { username: 'u', password: 'TOKEN' }, env)!
    expect(await fill(extra, 'https://h.example/g/r.git')).toBe('TOKEN')
    const anon = anonymousGitEnv('https://h.example/g/r.git', env, 'host', { configCount: true })!
    expect(await fill(anon, 'https://h.example/g/r.git')).toBeNull()
    // And without either, the machine answers — the helper the test relies on is real.
    expect(await fill({}, 'https://h.example/g/r.git')).toBe('machine-secret')
  })
})

/**
 * Which helpers git before 2.26 runs for `url`, from config entries in order
 * (credential.c, `credential_match`): each field the key's URL names must equal
 * the request's — the path exactly, never as a prefix. An empty value clears
 * the list so far.
 */
function helpersBefore226(entries: Array<[string, string]>, url: string): string[] {
  const want = new URL(url)
  const reqPath = want.pathname.replace(/^\/+/, '')
  let helpers: string[] = []
  for (const [key, value] of entries) {
    const m = /^credential\.(?:(.+)\.)?helper$/i.exec(key)
    if (!m) continue
    if (m[1]) {
      const c = new URL(m[1])
      if (c.protocol !== want.protocol || c.host !== want.host) continue
      const p = c.pathname.replace(/^\/+/, '')
      if (p && p !== reqPath) continue
    }
    helpers = value ? [...helpers, value] : []
  }
  return helpers
}

/** The `'key=value'` entries of a `GIT_CONFIG_PARAMETERS` value this module wrote. */
const entriesOf = (params: string): Array<[string, string]> =>
  [...params.matchAll(/'([^']*)'/g)].map((m) => {
    const i = m[1].indexOf('=')
    return [m[1].slice(0, i), m[1].slice(i + 1)]
  })

describe('F2: asking as nobody on git older than 2.26', () => {
  const url = 'https://h.example/bitbucket/scm/p/r.git'
  const scope = { prefix: 'https://h.example/bitbucket' }

  it('the version probe tells exact-match git apart', () => {
    for (const v of ['git version 2.25.1', 'git version 2.17.0', 'git version 1.9.5']) expect(gitMatchesCredentialUrlPrefix(v), v).toBe(false)
    for (const v of ['git version 2.26.0', 'git version 2.30.9', 'git version 2.56.1']) expect(gitMatchesCredentialUrlPrefix(v), v).toBe(true)
    // Unreadable counts as old: the extra entry is harmless on a newer git.
    expect(gitMatchesCredentialUrlPrefix('git version ???')).toBe(false)
  })

  it("the machine's helper is cleared for a server under a context path", () => {
    const extra = anonymousGitEnv(url, env, scope, { exactUrlMatch: true })!
    const entries: Array<[string, string]> = [['credential.helper', machine], ...entriesOf(extra.GIT_CONFIG_PARAMETERS!)]
    expect(helpersBefore226(entries, url)).toEqual([])
    // The prefix entry alone would not have matched: it is the origin's that does.
    const without = anonymousGitEnv(url, env, scope)!
    expect(helpersBefore226([['credential.helper', machine], ...entriesOf(without.GIT_CONFIG_PARAMETERS!)], url)).toEqual([machine])
  })

  it('the extra entry changes nothing on a current git: still nobody answers', async () => {
    for (const configCount of [true, false]) {
      const extra = anonymousGitEnv(url, env, scope, { exactUrlMatch: true, configCount })!
      expect(await fill(extra, url)).toBeNull()
    }
  })
})

describe('F3: a host git reads differently from the app', () => {
  const odd = [
    'https://[0:0:0:0:0:0:0:1]:8443/g/r.git',
    'https://[::FFFF:127.0.0.1]/g/r.git',
    'https://127.1/g/r.git',
    'https://0x7f.0.0.1/g/r.git',
    'https://bücher.example/g/r.git',
    'https://h%2eexample/g/r.git',
    'https://github.com\\@evil.example/o/r.git',
    'https://a@b@h.example/g/r.git'
  ]

  it('gets no credential handling at all — never a key that would not match', () => {
    for (const u of odd) {
      expect(canonicalUrlHost(u), u).toBe(false)
      expect(gitCredentialEnv(u, { username: 'u', password: 'p' }, env), u).toBeNull()
      expect(anonymousGitEnv(u, env, 'host', { configCount: true }), u).toBeNull()
    }
    for (const u of ['https://H.Example/g/r.git', 'https://h.example:443/g/r.git', 'https://u@h.example:8443/g', 'http://h.example:80/x']) {
      expect(canonicalUrlHost(u), u).toBe(true)
    }
  })

  it('a clone for a picked profile is refused with a reason, not left to the machine helper', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    for (const u of ['https://127.1/g/r.git', 'https://bücher.example/g/r.git']) {
      await expect(cloneCredentialEnv(u, 'gitlab', undefined, ''), u).rejects.toThrow(/git could read that server address/)
    }
    // Nobody picked a profile: git's own behaviour, as in a terminal.
    await expect(cloneCredentialEnv('https://127.1/g/r.git')).resolves.toBeNull()
  })

  it('the refusal is translated, and its host is redacted from a report', async () => {
    const { nonCanonicalHostMessage } = await import('../src/main/gitCredentialEnv')
    const { explainGitError } = await import('../src/renderer/src/lib/gitErrorHint')
    const { redactForReport } = await import('../src/renderer/src/lib/issueReport')
    const msg = "Error invoking remote method 'git': Error: " + nonCanonicalHostMessage('https://u@127.1:8443/g/r.git')
    expect(explainGitError(msg)).toEqual({ key: 'gitError.nonCanonicalHost', vars: { host: '127.1:8443' } })
    expect(redactForReport(msg)).not.toContain('127.1')
  })
})

describe('F4: a nested server reached through a path its proxy routes differently', () => {
  const nested = ['bitbucket;x', 'bitbucket%3Bx', 'Bitbucket', 'bitbucket.', 'BITBUCKET.', 'bitbucketx', '%62itbucket']

  it('the broker refuses the outer token for every spelling of the nested base', () => {
    const t = { host: 'h.example', path: '', pathSent: true, exclude: ['bitbucket'] }
    for (const seg of nested) {
      expect(requestInScope(t, { protocol: 'https', host: 'h.example', path: `${seg}/scm/p/r.git` }), seg).toBe(false)
    }
    // A `;` or a trailing dot anywhere, under a scope with carve-outs.
    expect(requestInScope(t, { protocol: 'https', host: 'h.example', path: 'grp/a;b/r.git' })).toBe(false)
    expect(requestInScope(t, { protocol: 'https', host: 'h.example', path: 'grp./r.git' })).toBe(false)
    // The outer server's own repositories still get it.
    expect(requestInScope(t, { protocol: 'https', host: 'h.example', path: 'grp/app.git' })).toBe(true)
    expect(requestInScope(t, { protocol: 'https', host: 'h.example', path: 'grp/app.git/info/lfs' })).toBe(true)
  })

  it('through real git: the GitLab token never reaches the Data Center', async () => {
    const extra = gitCredentialEnv('https://h.example/grp/app.git', { username: 'oauth2', password: 'GITLAB_ROOT' }, env, {
      prefix: 'https://h.example',
      exclude: ['https://h.example/bitbucket']
    })!
    expect(await fill(extra, 'https://h.example/grp/app.git')).toBe('GITLAB_ROOT')
    for (const seg of nested) {
      expect(await fill(extra, `https://h.example/${seg}/scm/p/r.git`), seg).not.toBe('GITLAB_ROOT')
    }
  })

  it('the resolver places none of them on a server, so no token is attached', () => {
    const reg = { gitlab: ['https://code.corp'], forgejo: [], githubEnterprise: [], bitbucketServer: ['https://code.corp/bitbucket'] }
    for (const u of [
      'https://code.corp/bitbucket;x/scm/p/r.git',
      'https://code.corp/bitbucket%3Bx/scm/p/r.git',
      'https://code.corp/bitbucket%3bx/scm/p/r.git',
      'https://code.corp/grp/app%00.git'
    ]) {
      expect(ambiguousRemotePath(u), u).toBe(true)
      expect(resolveRemoteProvider(u, reg), u).toBeNull()
    }
    expect(resolveRemoteProvider('https://code.corp/grp/app.git', reg)).toEqual({ provider: 'gitlab', base: 'https://code.corp' })
  })
})

describe('F5: spellings that locked a profile out', () => {
  it('a `%` in a repository path: git sends it decoded, and the broker does not decode it again', async () => {
    const host = { host: 'h.example', path: '', pathSent: true }
    expect(requestInScope(host, { protocol: 'https', host: 'h.example', path: 'g/a%b.git' })).toBe(true)
    const prefix = { host: 'h.example', path: 'team', pathSent: true }
    expect(requestInScope(prefix, { protocol: 'https', host: 'h.example', path: 'team/a%b.git' })).toBe(true)
    expect(requestInScope(prefix, { protocol: 'https', host: 'h.example', path: 'team%2Fx/r.git' })).toBe(false)
    const extra = gitCredentialEnv('https://h.example/g/a%25b.git', { username: 'u', password: 'PCT' }, env)!
    expect(await fill(extra, 'https://h.example/g/a%25b.git')).toBe('PCT')
    const scoped = gitCredentialEnv('https://h.example/team/a%25b.git', { username: 'u', password: 'PCT2' }, env, {
      prefix: 'https://h.example/team'
    })!
    expect(await fill(scoped, 'https://h.example/team/a%25b.git')).toBe('PCT2')
  })

  it('an explicit default port is the same server on both sides', async () => {
    const t = { host: 'h.example', path: '', pathSent: true }
    expect(requestInScope(t, { protocol: 'https', host: 'h.example:443', path: 'g/r.git' })).toBe(true)
    expect(requestInScope(t, { protocol: 'https', host: 'h.example:8443', path: 'g/r.git' })).toBe(false)
    const extra = gitCredentialEnv('https://h.example:443/g/r.git', { username: 'u', password: 'P443' }, env)!
    expect(await fill(extra, 'https://h.example:443/g/r.git')).toBe('P443')
    const plain = gitCredentialEnv('https://h.example/g/r.git', { username: 'u', password: 'P' }, env)!
    expect(await fill(plain, 'https://h.example:443/g/r.git')).toBe('P')
  })
})

describe('the per-provider matchers agree with the resolver', () => {
  it('github.com is decided by the host git connects to, not by a prefix of the text', () => {
    expect(githubInstanceOf('https://github.com:x@evil.com/o', [])).toBeNull()
    expect(githubInstanceOf('https://github.com:x@evil.com/o/r.git', [])).toBeNull()
    expect(githubBaseOfRemote('https://github.com\\@evil.com/o', [])).toBeNull()
    expect(githubBaseOfRemote('https://github.com/o/r.git', [])).toBe(GITHUB_COM)
    expect(githubInstanceOf('https://github.com/o/r.git', [])).toEqual({ base: GITHUB_COM, owner: 'o', repo: 'r' })
  })

  it('ssh on port 22 to a hostname a GitLab shares is not the Data Center', () => {
    const reg = { gitlab: ['https://code.corp'], forgejo: [], githubEnterprise: [], bitbucketServer: ['https://code.corp/bitbucket'] }
    const url = 'ssh://git@code.corp/p/r.git'
    expect(resolveRemoteProvider(url, reg)?.provider).toBe('gitlab')
    expect(bitbucketBaseOfRemote(url, reg.bitbucketServer, reg)).toBeNull()
    expect(bitbucketBaseOfRemote('ssh://git@code.corp:7999/p/r.git', reg.bitbucketServer, reg)).toBe('https://code.corp/bitbucket')
  })
})
