import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { execFileSync, spawn } from 'node:child_process'
import { createServer, type Server } from 'node:https'
import type { AddressInfo } from 'node:net'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../src/shared/types'
import { credentialConfig } from './credentialConfig'

// Which account a clone, and every fetch after it, signs in as — against real
// git, over real https, with a fake "machine" (a credential helper holding some
// other account) in a temp HOME. One origin hosts a GitLab at its root and a
// Bitbucket Data Center under /bitbucket, the shape where a token registered
// for the whole origin reaches the other server.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-cred-scope-'))
const hasOpenssl = (() => {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: () => undefined, on: () => undefined },
  dialog: {},
  shell: { openExternal: () => undefined, trashItem: async () => undefined },
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: () => {
      throw new Error('stubbed')
    },
    decryptString: () => {
      throw new Error('stubbed')
    }
  }
}))

const DC_TOKEN = 'work-dc-token'
const GL_TOKEN = 'work-gitlab-token'
const LONE_DC = 'https://dc.example.corp/bitbucket'
const LONE_DC_TOKEN = 'work-lone-dc-token'
const marker = join(dir, 'helper-was-asked')
const root = join(dir, 'served')
const ident = {
  GIT_AUTHOR_NAME: 'T',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'T',
  GIT_COMMITTER_EMAIL: 't@example.com'
}
const run = (cwd: string, args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...ident, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } })

let origin = ''
let server: Server
/** Every request: its path and the `user:password` it carried ('' for none). */
const received: Array<{ path: string; auth: string }> = []
const boundEmpty = join(dir, 'bound-empty')
const boundWork = join(dir, 'bound-work')
const unbound = join(dir, 'unbound')
/** Bound to Empty, its remote spelled without `.git`: the server redirects. */
const boundEmptyRedirect = join(dir, 'bound-empty-redirect')
/** Bound to Empty, its remote path built to smuggle a helper into the config. */
const boundHostile = join(dir, 'bound-hostile')
const pwned = join(dir, 'pwned')
const hostilePath = `/group/r/.helper=!touch$IFS${pwned}`
/** Bound to Work, a GitLab path with `=` in it. */
const boundWeird = join(dir, 'bound-weird')
/** Bound to Work, a Data Center remote spelled without `.git`. */
const boundDcRedirect = join(dir, 'bound-dc-redirect')
const saved = { ...process.env }

/** A bare repository under the served root with one commit, optionally with a submodule. */
function serve(path: string, submodule?: { url: string; sha: string }): string {
  const work = mkdtempSync(join(dir, 'work-'))
  run(work, ['init', '-q', '-b', 'main'])
  writeFileSync(join(work, 'README'), path)
  run(work, ['add', 'README'])
  if (submodule) {
    writeFileSync(join(work, '.gitmodules'), `[submodule "sub"]\n\tpath = sub\n\turl = ${submodule.url}\n`)
    run(work, ['add', '.gitmodules'])
    run(work, ['update-index', '--add', '--cacheinfo', `160000,${submodule.sha},sub`])
  }
  run(work, ['commit', '-q', '-m', 'init'])
  const bare = join(root, path)
  mkdirSync(bare, { recursive: true })
  run(bare, ['init', '-q', '--bare'])
  run(work, ['push', '-q', bare, 'main'])
  run(bare, ['symbolic-ref', 'HEAD', 'refs/heads/main'])
  return run(work, ['rev-parse', 'HEAD']).trim()
}

beforeAll(async () => {
  if (!hasOpenssl) return
  // A certificate for this run only, trusted through GIT_SSL_CAINFO.
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=127.0.0.1',
    '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem')
  ], { stdio: 'ignore' })

  const backend = join(execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(), 'git-http-backend')
  server = createServer({ key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')) }, (req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'https://x')
      const header = req.headers.authorization
      const auth = header ? Buffer.from(header.replace(/^Basic /, ''), 'base64').toString() : ''
      received.push({ path: url.pathname, auth })
      // `/g/p` → `/g/p.git`, as GitLab and Data Center answer a remote spelled
      // without the suffix. Only the first request, as git follows only that one.
      const short = /^(.*?)(\/info\/refs)$/.exec(url.pathname)
      if (short && !short[1].endsWith('.git') && existsSync(join(root, `${decodeURIComponent(short[1])}.git`))) {
        res.writeHead(301, { Location: `${short[1]}.git${short[2]}${url.search}` })
        res.end()
        return
      }
      // Every repository here is private: no credential, no access.
      if (!auth) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="test"' })
        res.end()
        return
      }
      const body = Buffer.concat(chunks)
      const cgi = spawn(backend, [], {
        env: {
          PATH: process.env.PATH,
          GIT_PROJECT_ROOT: root,
          GIT_HTTP_EXPORT_ALL: '1',
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          PATH_INFO: decodeURIComponent(url.pathname),
          QUERY_STRING: url.search.slice(1),
          REQUEST_METHOD: req.method ?? 'GET',
          CONTENT_TYPE: req.headers['content-type'] ?? '',
          CONTENT_LENGTH: String(body.length),
          HTTP_CONTENT_ENCODING: req.headers['content-encoding'] ?? '',
          GIT_PROTOCOL: String(req.headers['git-protocol'] ?? ''),
          REMOTE_USER: auth.split(':')[0],
          REMOTE_ADDR: '127.0.0.1'
        }
      })
      const out: Buffer[] = []
      cgi.stdout.on('data', (c: Buffer) => out.push(c))
      cgi.on('close', () => {
        const all = Buffer.concat(out)
        const split = all.indexOf('\r\n\r\n')
        const head = all.subarray(0, split).toString().split('\r\n')
        let status = 200
        const headers: Record<string, string> = {}
        for (const line of head) {
          const [k, ...v] = line.split(':')
          if (k.toLowerCase() === 'status') status = Number.parseInt(v.join(':').trim(), 10)
          else if (k) headers[k] = v.join(':').trim()
        }
        res.writeHead(status, headers)
        res.end(all.subarray(split + 4))
      })
      cgi.stdin.end(body)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `https://127.0.0.1:${(server.address() as AddressInfo).port}`

  const subSha = serve('group/sub.git')
  serve('bitbucket/scm/proj/top.git', { url: `${origin}/group/sub.git`, sha: subSha })
  serve('group/app.git')
  serve('group/we=ird.git')
  // A GitLab repository whose submodule lives on the Data Center nested under it.
  const dcSubSha = serve('bitbucket/scm/proj/sub2.git')
  serve('group/withdc.git', { url: `${origin}/bitbucket/scm/proj/sub2.git`, sha: dcSubSha })
  const remotes: Array<[string, string]> = [
    [boundEmpty, `${origin}/group/app.git`],
    [boundWork, `${origin}/group/app.git`],
    [unbound, `${origin}/group/app.git`],
    [boundEmptyRedirect, `${origin}/group/app`],
    [boundHostile, `${origin}${hostilePath}`],
    [boundWeird, `${origin}/group/we=ird.git`],
    [boundDcRedirect, `${origin}/bitbucket/scm/proj/top`]
  ]
  for (const [repo, remote] of remotes) {
    mkdirSync(repo)
    run(repo, ['init', '-q', '-b', 'main'])
    run(repo, ['remote', 'add', 'origin', remote])
  }

  const helper = join(dir, 'machine-helper.sh')
  writeFileSync(helper, `#!/bin/sh\ntouch '${marker}'\ntest "$1" = get && printf 'username=machine-user\\npassword=machine-secret\\n'\nexit 0\n`)
  chmodSync(helper, 0o755)
  writeFileSync(join(dir, 'gitconfig'), `[credential]\n\thelper = ${helper}\n`)

  writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
  const base = defaultSettings().profiles[0]
  writeFileSync(
    join(dir, 'gitcito-settings.json'),
    JSON.stringify({
      ...defaultSettings(),
      onboardingCompleted: true,
      activeProfileId: 'empty',
      repoProfiles: {
        [boundEmpty]: 'empty',
        [boundWork]: 'work',
        [boundEmptyRedirect]: 'empty',
        [boundHostile]: 'empty',
        [boundWeird]: 'work',
        [boundDcRedirect]: 'work'
      },
      profiles: [
        {
          ...base,
          id: 'work',
          name: 'Work',
          gitlabServers: [{ url: origin, token: GL_TOKEN }],
          bitbucketServers: [
            { url: `${origin}/bitbucket`, token: DC_TOKEN, username: 'worker' },
            { url: LONE_DC, token: LONE_DC_TOKEN, username: 'worker' }
          ]
        },
        { ...base, id: 'empty', name: 'Empty', githubToken: '', gitlabToken: '' }
      ]
    })
  )
  const { readSettings } = await import('../src/main/settings')
  await readSettings()
})

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
  rmSync(dir, { recursive: true, force: true })
})

/** The fake machine: a helper holding another account for every host. */
const asMachine = (): void => {
  Object.assign(process.env, {
    HOME: dir,
    GIT_CONFIG_GLOBAL: join(dir, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_SSL_CAINFO: join(dir, 'cert.pem')
  })
}

afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
  received.length = 0
  rmSync(marker, { force: true })
})

/**
 * What git-lfs gets for `url` under `env`: it sends the path only when
 * `credential.<url>.useHttpPath` says so, and asks with none otherwise.
 */
function lfsFill(env: NodeJS.ProcessEnv, url: string): string {
  const u = new URL(url)
  const gitEnv = {
    PATH: process.env.PATH,
    HOME: dir,
    GIT_CONFIG_GLOBAL: join(dir, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    ...env
  }
  let withPath = false
  try {
    withPath =
      execFileSync('git', ['config', '--type=bool', '--get-urlmatch', 'credential.usehttppath', url], {
        env: gitEnv,
        encoding: 'utf8'
      }).trim() === 'true'
  } catch {
    withPath = false
  }
  try {
    return execFileSync('git', ['credential', 'fill'], {
      input: `protocol=https\nhost=${u.host}\n${withPath ? `path=${u.pathname.slice(1)}\n` : ''}\n`,
      env: gitEnv,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch {
    return ''
  }
}

/** What git's credential step hands out for `url` under `env`. */
function fill(env: NodeJS.ProcessEnv, url: string): string {
  const u = new URL(url)
  try {
    return execFileSync('git', ['credential', 'fill'], {
      input: `protocol=https\nhost=${u.host}\npath=${u.pathname.slice(1)}\n\n`,
      env: {
        PATH: process.env.PATH,
        HOME: dir,
        GIT_CONFIG_GLOBAL: join(dir, 'gitconfig'),
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_TERMINAL_PROMPT: '0',
        ...env
      },
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch {
    return ''
  }
}

describe.skipIf(!hasOpenssl)('a token reaches its own server only', () => {
  // `--recurse-submodules` hands the clone's environment to every submodule
  // clone. Registered for the whole origin, the Data Center's token went to the
  // GitLab beside it too.
  it('a Data Center clone’s submodule on the same origin’s GitLab never sees the Data Center token', async () => {
    asMachine()
    const { gitService } = await import('../src/main/git')
    const parent = mkdtempSync(join(dir, 'clone-'))
    await gitService.clone(parent, `${origin}/bitbucket/scm/proj/top.git`, 'top', {
      host: 'bitbucket',
      profileId: 'work',
      recurseSubmodules: true
    })
    expect(existsSync(join(parent, 'top', 'sub', 'README'))).toBe(true)
    const top = received.filter((r) => r.path.startsWith('/bitbucket/'))
    const sub = received.filter((r) => r.path.startsWith('/group/sub.git'))
    expect(top.some((r) => r.auth === `worker:${DC_TOKEN}`)).toBe(true)
    expect(sub.length).toBeGreaterThan(0)
    expect(sub.some((r) => r.auth.includes(DC_TOKEN))).toBe(false)
    // The submodule is left to git, as a terminal clone would leave it.
    expect(sub.some((r) => r.auth === 'machine-user:machine-secret')).toBe(true)
  })

  it('a GitLab clone’s submodule on the Data Center nested under it never sees the GitLab token', async () => {
    asMachine()
    const { gitService, cloneCredentialEnv } = await import('../src/main/git')
    const parent = mkdtempSync(join(dir, 'clone-'))
    // The nested server is carved out: asked as nobody, so its private
    // submodule is refused — never answered with the GitLab's token.
    await expect(
      gitService.clone(parent, `${origin}/group/withdc.git`, 'withdc', {
        host: 'gitlab',
        profileId: 'work',
        recurseSubmodules: true
      })
    ).rejects.toThrow()
    const top = received.filter((r) => r.path.startsWith('/group/withdc.git'))
    const sub = received.filter((r) => r.path.startsWith('/bitbucket/'))
    expect(top.some((r) => r.auth === `oauth2:${GL_TOKEN}`)).toBe(true)
    expect(sub.length).toBeGreaterThan(0)
    expect(sub.some((r) => r.auth.includes(GL_TOKEN))).toBe(false)
    // …and not through git-lfs either, which asks with no path unless told to.
    const env = (await cloneCredentialEnv(`${origin}/group/withdc.git`, 'gitlab', undefined, 'work')) ?? {}
    expect(lfsFill(env, `${origin}/group/withdc.git/info/lfs`)).toContain(`password=${GL_TOKEN}`)
    expect(lfsFill(env, `${origin}/bitbucket/scm/proj/sub2.git/info/lfs`)).not.toContain(GL_TOKEN)
  })

  it('git-lfs gets a Data Center’s token for its repository, beside a GitLab on the origin and alone', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const shared = (await cloneCredentialEnv(`${origin}/bitbucket/scm/proj/top.git`, 'bitbucket', undefined, 'work')) ?? {}
    expect(lfsFill(shared, `${origin}/bitbucket/scm/proj/top.git/info/lfs`)).toContain(`password=${DC_TOKEN}`)
    expect(lfsFill(shared, `${origin}/group/app.git/info/lfs`)).not.toContain(DC_TOKEN)
    const lone = (await cloneCredentialEnv(`${LONE_DC}/scm/proj/app.git`, 'bitbucket', undefined, 'work')) ?? {}
    expect(lfsFill(lone, `${LONE_DC}/scm/proj/app.git/info/lfs`)).toContain(`password=${LONE_DC_TOKEN}`)
  })

  it('a clone the server redirects to `.git` keeps its token', async () => {
    asMachine()
    const { gitService } = await import('../src/main/git')
    const parent = mkdtempSync(join(dir, 'clone-'))
    await gitService.clone(parent, `${origin}/bitbucket/scm/proj/top`, 'top', { host: 'bitbucket', profileId: 'work' })
    expect(existsSync(join(parent, 'top', 'README'))).toBe(true)
    expect(received.some((r) => r.path.startsWith('/bitbucket/scm/proj/top.git/') && r.auth === `worker:${DC_TOKEN}`)).toBe(true)
    expect(received.some((r) => r.auth.includes('machine'))).toBe(false)
  })

  it('a server alone on its origin under a context path: its token covers that base, nothing else', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = (await cloneCredentialEnv(`${LONE_DC}/scm/proj/app.git`, 'bitbucket', undefined, 'work')) ?? {}
    expect(Object.entries(env).some(([k, v]) => k.startsWith('GIT_CONFIG_KEY_') && v === `credential.${LONE_DC}.helper`)).toBe(true)
    expect(fill(env, `${LONE_DC}/scm/proj/app.git`)).toContain(`password=${LONE_DC_TOKEN}`)
    // Another repository on the same server, as after a redirect: still its token.
    expect(fill(env, `${LONE_DC}/scm/other/lib.git`)).toContain(`password=${LONE_DC_TOKEN}`)
    // Outside the base: not offered — git's own helper answers.
    expect(fill(env, 'https://dc.example.corp/gitlab/group/app.git')).not.toContain(LONE_DC_TOKEN)
    expect(fill(env, 'https://dc.example.corp/bitbucketx/scm/p/r.git')).not.toContain(LONE_DC_TOKEN)
  })
})

describe.skipIf(!hasOpenssl)('Clone → URL resolves the provider from the address', () => {
  it('github.com with a picked profile that has nothing: anonymous, the machine’s helper unasked', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const url = 'https://github.com/team/app.git'
    const env = await cloneCredentialEnv(url, undefined, undefined, 'empty')
    expect(env).not.toBeNull()
    expect(fill(env ?? {}, url)).not.toContain('machine-secret')
    expect(existsSync(marker)).toBe(false)
    // Nobody picked: git's own behaviour, as in a terminal.
    expect(await cloneCredentialEnv(url, undefined, undefined)).toBeNull()
  })

  it('a configured GitLab: the picked profile signs in, or nobody does — never the machine', async () => {
    asMachine()
    const { gitService } = await import('../src/main/git')
    await expect(gitService.remoteBranches(`${origin}/group/app.git`, undefined, undefined, 'work')).resolves.toEqual(['main'])
    expect(received.some((r) => r.auth === `oauth2:${GL_TOKEN}`)).toBe(true)
    expect(received.some((r) => r.auth.includes('machine'))).toBe(false)
    received.length = 0

    await expect(gitService.remoteBranches(`${origin}/group/app.git`, undefined, undefined, 'empty')).rejects.toThrow()
    expect(received.length).toBeGreaterThan(0)
    expect(received.every((r) => r.auth === '')).toBe(true)
    expect(existsSync(marker)).toBe(false)
  })

  it('an address no profile can serve is left to git, helper included', async () => {
    asMachine()
    const { gitService } = await import('../src/main/git')
    const port = new URL(origin).port
    await expect(
      gitService.remoteBranches(`https://localhost:${port}/group/app.git`, undefined, undefined, 'empty')
    ).resolves.toEqual(['main'])
    expect(received.some((r) => r.auth === 'machine-user:machine-secret')).toBe(true)
  })
})

describe.skipIf(!hasOpenssl)('fetch on a repository bound to a profile', () => {
  it('bound to a profile with no credential for the server: asked as nobody, not as the machine', async () => {
    asMachine()
    const { gitService } = await import('../src/main/git')
    await expect(gitService.fetchRemote(boundEmpty, 'origin')).rejects.toThrow()
    expect(received.length).toBeGreaterThan(0)
    expect(received.every((r) => r.auth === '')).toBe(true)
    expect(existsSync(marker)).toBe(false)
  })

  it('the push-account check agrees: no helper login is reported for it', async () => {
    asMachine()
    const { checkRemoteAuth } = await import('../src/main/remoteAuthCheck')
    const check = await checkRemoteAuth(boundEmpty, 'origin', `${origin}/group/app.git`)
    expect(check.source).not.toBe('helper')
    expect(check.login).toBeUndefined()
    expect(existsSync(marker)).toBe(false)
  })

  it('bound, with no credential: the error names the bound profile, not git’s credential helper', async () => {
    asMachine()
    const { gitService } = await import('../src/main/git')
    const err = await gitService.fetchRemote(boundEmpty, 'origin').then(() => null, (e: Error) => e)
    expect(err?.message).toMatch(
      /No GitLab account is linked to the profile "Empty" this repository is bound to, for 127\.0\.0\.1:\d+\./
    )
    expect(err?.message).not.toMatch(/could not read Username/)
  })

  it('bound, with no credential: nobody answers after a redirect, nor for git-lfs', async () => {
    asMachine()
    const { gitService, remoteOperationEnv } = await import('../src/main/git')
    await expect(gitService.fetchRemote(boundEmptyRedirect, 'origin')).rejects.toThrow()
    expect(received.some((r) => r.path.startsWith('/group/app.git/'))).toBe(true)
    expect(received.every((r) => r.auth === '')).toBe(true)
    expect(existsSync(marker)).toBe(false)
    const { env } = await remoteOperationEnv(boundEmpty, 'origin', 'fetch')
    expect(lfsFill(env ?? {}, `${origin}/group/app.git/info/lfs`)).not.toContain('machine-secret')
    expect(existsSync(marker)).toBe(false)
  })

  // The old `'key=value'` form split at the first `=`: this path made
  // `!touch …` the value of a `credential.<url>.helper`, run on the 401.
  it('bound, with no credential, a remote path cannot smuggle a helper in', async () => {
    asMachine()
    // A machine with no helper of its own, the common case: one that answers
    // first would hide the smuggled helper behind it.
    const bare = join(dir, 'gitconfig-bare')
    writeFileSync(bare, '')
    process.env.GIT_CONFIG_GLOBAL = bare
    const { gitService, remoteOperationEnv } = await import('../src/main/git')
    await expect(gitService.fetchRemote(boundHostile, 'origin')).rejects.toThrow()
    expect(received.length).toBeGreaterThan(0)
    expect(readdirSync(dir).filter((f) => f.startsWith('pwned'))).toEqual([])
    const { env } = await remoteOperationEnv(boundHostile, 'origin', 'fetch')
    expect(credentialConfig(env)).toEqual([`credential.${origin}.helper`, `credential.${origin}.usehttppath true`])
  })

  it('bound to a profile with a token, a remote path with `=` in it fetches', async () => {
    asMachine()
    const { gitService } = await import('../src/main/git')
    await gitService.fetchRemote(boundWeird, 'origin')
    expect(received.some((r) => r.path.startsWith('/group/we=ird.git/') && r.auth === `oauth2:${GL_TOKEN}`)).toBe(true)
    expect(received.some((r) => r.auth.includes('machine'))).toBe(false)
  })

  it('bound to a profile with a token, a fetch the server redirects keeps it', async () => {
    asMachine()
    const { gitService } = await import('../src/main/git')
    await gitService.fetchRemote(boundDcRedirect, 'origin')
    expect(received.some((r) => r.path.startsWith('/bitbucket/scm/proj/top.git/') && r.auth === `worker:${DC_TOKEN}`)).toBe(true)
    expect(received.some((r) => r.auth.includes('machine'))).toBe(false)
  })

  it('bound to a profile with a token: that token', async () => {
    asMachine()
    const { gitService } = await import('../src/main/git')
    await gitService.fetchRemote(boundWork, 'origin')
    expect(received.some((r) => r.auth === `oauth2:${GL_TOKEN}`)).toBe(true)
    expect(received.some((r) => r.auth.includes('machine'))).toBe(false)
  })

  it('not bound, and the active profile has nothing for the server: git’s helper still answers', async () => {
    asMachine()
    const { gitService } = await import('../src/main/git')
    await gitService.fetchRemote(unbound, 'origin')
    expect(received.some((r) => r.auth === 'machine-user:machine-secret')).toBe(true)
  })
})
