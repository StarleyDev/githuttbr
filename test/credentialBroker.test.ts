import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { execFileSync, spawn } from 'node:child_process'
import { createServer, type Server } from 'node:https'
import { connect, type AddressInfo } from 'node:net'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { defaultSettings } from '../src/shared/types'

// The profile's token reaches git's credential helper over a private endpoint
// the app serves for one run, never through git's environment — which every
// hook, filter and LFS process git starts inherits. Real git, real https, real
// hooks: a hook that dumps its environment must find no token in it.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-cred-broker-'))
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

const TOKEN = 'glpat-broker-secret-0123456789'
// A Data Center nested under the GitLab at the origin's root, with a token of its own.
const DC_TOKEN = 'bbs-broker-secret-9876543210'
const root = join(dir, 'served')
const ident = {
  GIT_AUTHOR_NAME: 'T',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'T',
  GIT_COMMITTER_EMAIL: 't@example.com'
}
const gitEnv = { ...process.env, ...ident, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
const run = (cwd: string, args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8', env: gitEnv })

let origin = ''
let server: Server
const received: Array<{ path: string; auth: string }> = []
const repo = join(dir, 'bound')
const saved = { ...process.env }

/** A hook that writes the environment it was given to `out`, then runs `extra`. */
function hook(name: string, out: string, extra = ''): void {
  const p = join(repo, '.git', 'hooks', name)
  writeFileSync(p, `#!/bin/sh\nenv > '${out}'\n${extra}\nexit 0\n`)
  chmodSync(p, 0o755)
}

/** The endpoint, nonce variable and nonce a dumped environment names. */
function endpointIn(dump: string): { endpoint: string; script: string; nonceVar: string; nonce: string; helper: string } {
  const helper = dump.split('\n').find((l) => /^GIT_CONFIG_VALUE_\d+=!/.test(l))!.replace(/^GIT_CONFIG_VALUE_\d+=/, '')
  const m = /'([^']*)' '([^']*)' (GITCITO_CREDENTIAL_\d+)$/.exec(helper)!
  const nonce = dump.split('\n').find((l) => l.startsWith(`${m[3]}=`))!.slice(m[3].length + 1)
  return { script: m[1], endpoint: m[2], nonceVar: m[3], nonce, helper: helper.slice(1) }
}

/** Speak the endpoint's protocol directly, as a hostile process would. */
function ask(endpoint: string, req: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock = connect(endpoint)
    let out = ''
    sock.setEncoding('utf8')
    sock.on('connect', () => sock.write(JSON.stringify(req) + '\n'))
    sock.on('data', (d: string) => (out += d))
    sock.on('error', reject)
    sock.on('close', () => resolve(out))
  })
}

/** Run the registered helper command as git would (`<helper> get`), with `input` on stdin. */
function runHelper(helper: string, input: string, env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', `${helper} get`], { env })
    let out = ''
    child.stdout.setEncoding('utf8').on('data', (d: string) => (out += d))
    child.on('close', () => resolve(out))
    // A helper that exits without reading (store, erase) closes the pipe first.
    child.stdin.on('error', () => undefined)
    child.stdin.end(input)
  })
}

beforeAll(async () => {
  if (!hasOpenssl) return
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
      // A moved repository: git follows the redirect and asks for a credential again.
      if (url.pathname.startsWith('/moved/')) {
        res.writeHead(301, { Location: url.pathname.replace('/moved/', '/group/') + url.search })
        res.end()
        return
      }
      const header = req.headers.authorization
      const auth = header ? Buffer.from(header.replace(/^Basic /, ''), 'base64').toString() : ''
      received.push({ path: url.pathname, auth })
      const expected = url.pathname.startsWith('/b/') ? `worker:${DC_TOKEN}` : `oauth2:${TOKEN}`
      if (auth !== expected) {
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
          REMOTE_USER: 'oauth2',
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
      // http-backend may answer (and exit) before reading the whole body — e.g. a
      // 401 — so a late write gets EPIPE. That is the server's choice, not a failure.
      cgi.stdin.on('error', () => {})
      cgi.stdin.end(body)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `https://127.0.0.1:${(server.address() as AddressInfo).port}`

  const work = mkdtempSync(join(dir, 'work-'))
  run(work, ['init', '-q', '-b', 'main'])
  writeFileSync(join(work, 'README'), 'app')
  run(work, ['add', 'README'])
  run(work, ['commit', '-q', '-m', 'init'])
  const bare = join(root, 'group/app.git')
  mkdirSync(bare, { recursive: true })
  run(bare, ['init', '-q', '--bare'])
  run(work, ['push', '-q', bare, 'main'])
  run(bare, ['symbolic-ref', 'HEAD', 'refs/heads/main'])

  const dcBare = join(root, 'b/scm/proj/app.git')
  mkdirSync(dcBare, { recursive: true })
  run(dcBare, ['init', '-q', '--bare'])
  run(work, ['push', '-q', dcBare, 'main'])

  run(dir, ['clone', '-q', bare, repo])
  run(repo, ['remote', 'set-url', 'origin', `${origin}/group/app.git`])
  // One push, two servers on one origin: each URL must be offered its own token only.
  run(repo, ['remote', 'add', 'both', `${origin}/group/app.git`])
  run(repo, ['remote', 'set-url', '--add', '--push', 'both', `${origin}/group/app.git`])
  run(repo, ['remote', 'set-url', '--add', '--push', 'both', `${origin}/b/scm/proj/app.git`])

  writeFileSync(join(dir, 'gitconfig'), '')
  writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
  const base = defaultSettings().profiles[0]
  writeFileSync(
    join(dir, 'gitcito-settings.json'),
    JSON.stringify({
      ...defaultSettings(),
      onboardingCompleted: true,
      activeProfileId: 'work',
      repoProfiles: { [repo]: 'work' },
      profiles: [
        {
          ...base,
          id: 'work',
          name: 'Work',
          gitlabServers: [{ url: origin, token: TOKEN }],
          bitbucketServers: [{ url: `${origin}/b`, token: DC_TOKEN, username: 'worker' }]
        }
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

const isolated = (): void => {
  Object.assign(process.env, {
    ...ident,
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
})

describe.skipIf(!hasOpenssl)("a profile's token never enters git's environment", () => {
  it('a pre-push hook that dumps its environment finds no token — and the push still signs in', async () => {
    isolated()
    const { gitService } = await import('../src/main/git')
    const dump = join(dir, 'pre-push.env')
    hook('pre-push', dump)
    writeFileSync(join(repo, 'one'), '1')
    run(repo, ['add', 'one'])
    run(repo, ['commit', '-q', '-m', 'one'])
    await gitService.push(repo, 'main')
    const env = readFileSync(dump, 'utf8')
    expect(env).not.toContain(TOKEN)
    expect(env).not.toContain('GITCITO_GIT_PASSWORD')
    expect(env).toContain('GITCITO_CREDENTIAL_')
    expect(received.some((r) => r.auth === `oauth2:${TOKEN}` && r.path.endsWith('git-receive-pack'))).toBe(true)
  })

  it('a reference-transaction hook during fetch sees no token either; the fetch signs in', async () => {
    isolated()
    const { gitService } = await import('../src/main/git')
    const dump = join(dir, 'ref-tx.env')
    rmSync(join(repo, '.git', 'hooks', 'pre-push'), { force: true })
    hook('reference-transaction', dump)
    await gitService.fetchRemote(repo, 'origin')
    rmSync(join(repo, '.git', 'hooks', 'reference-transaction'), { force: true })
    expect(existsSync(dump)).toBe(true)
    expect(readFileSync(dump, 'utf8')).not.toContain(TOKEN)
    expect(received.some((r) => r.auth === `oauth2:${TOKEN}`)).toBe(true)
  })

  it('a clone signs in through the endpoint, and nothing of it is left afterwards', async () => {
    isolated()
    const { gitService } = await import('../src/main/git')
    const { openCredentialEndpoints } = await import('../src/main/credentialBroker')
    const parent = mkdtempSync(join(dir, 'clone-'))
    await gitService.clone(parent, `${origin}/group/app.git`, 'app', { host: 'gitlab', profileId: 'work' })
    expect(existsSync(join(parent, 'app', 'README'))).toBe(true)
    expect(received.some((r) => r.auth === `oauth2:${TOKEN}`)).toBe(true)
    expect(openCredentialEndpoints()).toBe(0)
  })

  it('serves every get of one run: a redirect, and an LFS-style `git credential fill` from a hook', async () => {
    isolated()
    const { gitService } = await import('../src/main/git')
    // A redirect: git asks again for the URL it was sent to.
    await expect(gitService.remoteBranches(`${origin}/moved/app.git`, 'gitlab', undefined, 'work')).resolves.toEqual(['main'])
    expect(received.some((r) => r.path.startsWith('/group/') && r.auth === `oauth2:${TOKEN}`)).toBe(true)

    // git-lfs's pre-push hook asks git's helpers itself, in a process of its
    // own, while the push is running; then the push asks for its own pack.
    const dump = join(dir, 'lfs.env')
    const asked = join(dir, 'lfs.answer')
    hook('pre-push', dump, `printf 'protocol=https\\nhost=${new URL(origin).host}\\npath=group/app.git/info/lfs\\n\\n' | git credential fill > '${asked}'`)
    writeFileSync(join(repo, 'two'), '2')
    run(repo, ['add', 'two'])
    run(repo, ['commit', '-q', '-m', 'two'])
    await gitService.push(repo, 'main')
    rmSync(join(repo, '.git', 'hooks', 'pre-push'), { force: true })
    expect(readFileSync(asked, 'utf8')).toContain(`password=${TOKEN}`)
    expect(received.some((r) => r.auth === `oauth2:${TOKEN}` && r.path.endsWith('git-receive-pack'))).toBe(true)
  })

  it('a push to two servers stacks two endpoints, and each answers only for its own server', async () => {
    isolated()
    const { gitService } = await import('../src/main/git')
    const dump = join(dir, 'stacked.env')
    hook('pre-push', dump)
    writeFileSync(join(repo, 'stacked'), 's')
    run(repo, ['add', 'stacked'])
    run(repo, ['commit', '-q', '-m', 'stacked'])
    await gitService.push(repo, 'main', { remote: 'both' })
    rmSync(join(repo, '.git', 'hooks', 'pre-push'), { force: true })
    const env = readFileSync(dump, 'utf8')
    expect(env).not.toContain(TOKEN)
    expect(env).not.toContain(DC_TOKEN)
    expect(env.match(/^GITCITO_CREDENTIAL_\d+=/gm)?.length).toBe(2)
    const packs = received.filter((r) => r.path.endsWith('git-receive-pack'))
    expect(packs.some((r) => r.path.startsWith('/group/') && r.auth === `oauth2:${TOKEN}`)).toBe(true)
    expect(packs.some((r) => r.path.startsWith('/b/') && r.auth === `worker:${DC_TOKEN}`)).toBe(true)
    // Nothing ever crossed over: not the GitLab token to the Data Center, nor back.
    expect(received.some((r) => r.path.startsWith('/b/') && r.auth.includes(TOKEN))).toBe(false)
    expect(received.some((r) => r.path.startsWith('/group/') && r.auth.includes(DC_TOKEN))).toBe(false)
  })

  it('once the run is over the endpoint is gone: socket, helper and directory, and a late ask gets nothing', async () => {
    isolated()
    const { gitService } = await import('../src/main/git')
    const { openCredentialEndpoints } = await import('../src/main/credentialBroker')
    const dump = join(dir, 'late.env')
    // The hook copies the endpoint's coordinates out while the run is live.
    hook('pre-push', dump)
    writeFileSync(join(repo, 'three'), '3')
    run(repo, ['add', 'three'])
    run(repo, ['commit', '-q', '-m', 'three'])
    await gitService.push(repo, 'main')
    rmSync(join(repo, '.git', 'hooks', 'pre-push'), { force: true })
    const stolen = endpointIn(readFileSync(dump, 'utf8'))
    expect(openCredentialEndpoints()).toBe(0)
    expect(existsSync(stolen.endpoint)).toBe(false)
    expect(existsSync(stolen.script)).toBe(false)
    expect(existsSync(dirname(stolen.endpoint))).toBe(false)
    const host = new URL(origin).host
    await expect(ask(stolen.endpoint, { nonce: stolen.nonce, protocol: 'https', host, path: 'group/app.git' })).rejects.toThrow()
    const env = { ...process.env, [stolen.nonceVar]: stolen.nonce }
    expect(await runHelper(stolen.helper, `protocol=https\nhost=${host}\npath=group/app.git\n\n`, env)).toBe('')
  })
})

describe('the endpoint itself', () => {
  const opened: NodeJS.ProcessEnv[] = []
  afterAll(async () => {
    const { releaseCredentialEnv } = await import('../src/main/credentialBroker')
    for (const e of opened) releaseCredentialEnv(e)
  })

  async function openOne(
    scope: 'host' | { prefix: string; exclude?: string[] } = { prefix: 'https://git.example.com/team/app.git' }
  ): Promise<{ env: NodeJS.ProcessEnv; endpoint: string; helper: string; nonceVar: string; nonce: string }> {
    const { gitCredentialEnv } = await import('../src/main/gitCredentialEnv')
    const env = gitCredentialEnv('https://git.example.com/team/app.git', { username: 'oauth2', password: TOKEN }, {}, scope)!
    opened.push(env)
    const dump = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n')
    return { env, ...endpointIn(dump) }
  }

  it('lives in a directory only its owner can enter', async () => {
    if (process.platform === 'win32') return
    const { endpoint } = await openOne()
    expect(statSync(dirname(endpoint)).mode & 0o777).toBe(0o700)
  })

  it('answers its own nonce, for its own repository', async () => {
    const { endpoint, nonce } = await openOne()
    const r = JSON.parse(await ask(endpoint, { nonce, protocol: 'https', host: 'git.example.com', path: 'team/app.git' }))
    expect(r).toEqual({ username: 'oauth2', password: TOKEN })
    // An LFS endpoint under the repository is the same repository.
    const lfs = JSON.parse(await ask(endpoint, { nonce, protocol: 'https', host: 'git.example.com', path: 'team/app.git/info/lfs' }))
    expect(lfs.password).toBe(TOKEN)
  })

  it('a wrong nonce, or none, gets nothing', async () => {
    const { endpoint, nonce, helper, nonceVar } = await openOne()
    const req = { protocol: 'https', host: 'git.example.com', path: 'team/app.git' }
    expect(JSON.parse(await ask(endpoint, { ...req, nonce: nonce.slice(0, -1) + (nonce.endsWith('0') ? '1' : '0') }))).toEqual({})
    expect(JSON.parse(await ask(endpoint, { ...req, nonce: '' }))).toEqual({})
    expect(JSON.parse(await ask(endpoint, req))).toEqual({})
    // Another endpoint's nonce opens nothing here.
    const other = await openOne()
    expect(JSON.parse(await ask(endpoint, { ...req, nonce: other.nonce }))).toEqual({})
    // Through the helper, with the variable missing.
    const input = 'protocol=https\nhost=git.example.com\npath=team/app.git\n\n'
    expect(await runHelper(helper, input, { PATH: process.env.PATH, [nonceVar]: 'nope' })).toBe('')
    expect(await runHelper(helper, input, { PATH: process.env.PATH, [nonceVar]: nonce })).toContain(`password=${TOKEN}`)
  })

  it('refuses a host, protocol or path outside the scope it was opened for, even with the right nonce', async () => {
    const { endpoint, nonce, helper, nonceVar } = await openOne()
    const ok = { nonce, protocol: 'https', host: 'git.example.com', path: 'team/app.git' }
    for (const bad of [
      { host: 'evil.example.com' },
      { host: 'git.example.com:8443' },
      { protocol: 'http' },
      { path: 'team/other.git' },
      { path: 'team/app.gitx' },
      { path: 'team' }
    ]) {
      expect(JSON.parse(await ask(endpoint, { ...ok, ...bad })), JSON.stringify(bad)).toEqual({})
    }
    // A path-scoped entry tells git to send the path (useHttpPath); a request without one is refused.
    const noPath = { nonce, protocol: 'https', host: 'git.example.com' }
    expect(JSON.parse(await ask(endpoint, noPath))).toEqual({})
    // The same through the helper git runs, as a hook speaking its protocol would.
    const env = { PATH: process.env.PATH, [nonceVar]: nonce }
    expect(await runHelper(helper, 'protocol=https\nhost=evil.example.com\npath=team/app.git\n\n', env)).toBe('')
  })

  it('a host scope answers any path on that host, a prefix scope only below its base', async () => {
    const host = await openOne('host')
    const any = { nonce: host.nonce, protocol: 'https', host: 'git.example.com' }
    expect(JSON.parse(await ask(host.endpoint, { ...any, path: 'else/where.git' })).password).toBe(TOKEN)
    expect(JSON.parse(await ask(host.endpoint, any)).password).toBe(TOKEN)

    const prefix = await openOne({ prefix: 'https://git.example.com/team' })
    const p = { nonce: prefix.nonce, protocol: 'https', host: 'git.example.com' }
    expect(JSON.parse(await ask(prefix.endpoint, { ...p, path: 'team/lib.git' })).password).toBe(TOKEN)
    expect(JSON.parse(await ask(prefix.endpoint, { ...p, path: 'teamx/lib.git' }))).toEqual({})
  })

  it('an outer server refuses the server nested under it, in any spelling of its path', async () => {
    const outer = await openOne({ prefix: 'https://git.example.com', exclude: ['https://git.example.com/bitbucket'] })
    const q = { nonce: outer.nonce, protocol: 'https', host: 'git.example.com' }
    expect(JSON.parse(await ask(outer.endpoint, { ...q, path: 'team/app.git' })).password).toBe(TOKEN)
    expect(JSON.parse(await ask(outer.endpoint, { ...q, path: 'bitbucket/scm/p/r.git' }))).toEqual({})
    expect(JSON.parse(await ask(outer.endpoint, { ...q, path: '%62itbucket/scm/p/r.git' }))).toEqual({})
    // With a carve-out, "no path" could be either server: refused.
    expect(JSON.parse(await ask(outer.endpoint, q))).toEqual({})
  })

  it('store and erase are no-ops: the helper answers only get', async () => {
    const { helper, nonceVar, nonce } = await openOne()
    const env = { PATH: process.env.PATH, [nonceVar]: nonce }
    for (const action of ['store', 'erase']) {
      const out = await new Promise<string>((resolve) => {
        const child = spawn('sh', ['-c', `${helper} ${action}`], { env })
        let o = ''
        child.stdout.setEncoding('utf8').on('data', (d: string) => (o += d))
        child.on('close', () => resolve(o))
        // A helper that exits without reading (store, erase) closes the pipe first.
        child.stdin.on('error', () => undefined)
        child.stdin.end('protocol=https\nhost=git.example.com\npath=team/app.git\n\n')
      })
      expect(out).toBe('')
    }
  })
})
