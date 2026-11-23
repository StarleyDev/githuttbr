/**
 * Serve one credential to the credential helper of one git run, over a private
 * local socket, so the secret never sits in git's environment.
 *
 * git hands its whole environment to everything it starts: hooks (husky,
 * lefthook, a `post-merge` a pull triggers), filters, fsmonitor, LFS, an
 * `core.sshCommand`. A token in a variable there was readable by any of them,
 * and by every npm dependency a hook runs, without a keychain prompt.
 *
 * Instead each registration opens an endpoint of its own — a Unix domain
 * socket in a fresh 0700 directory, or a named pipe with a random name on
 * Windows — and puts only a random nonce in the environment. The helper (a
 * tiny script beside the socket, run by this same binary as plain Node) reads
 * git's request, connects, sends the nonce with the protocol, host and path git
 * asked about, and prints the answer. The endpoint answers only that nonce, and
 * only for a URL inside the scope it was opened for; it serves every `get` of
 * the run — git may ask more than once (LFS, a redirect, a retry after a 401) —
 * and is closed, socket and directory removed, when the caller releases it once
 * git has exited. A nonce read later, or by another process, opens nothing.
 */
import { createServer, type Server, type Socket } from 'node:net'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** The environment variable (suffixed `_<n>`) that carries an endpoint's nonce to its helper. */
export const CREDENTIAL_NONCE_VAR = 'GITCITO_CREDENTIAL'

/** Which requests an endpoint answers: git's `protocol`, `host` and, when it sends one, `path`. */
export interface CredentialTarget {
  /** `host[:port]`, lowercase, as git sends it. */
  host: string
  /** The path the scope covers, without leading or trailing `/`; '' for the whole host. */
  path: string
  /** Whether git is told to send the path (`useHttpPath`): then a request without one is refused. */
  pathSent: boolean
}

interface Endpoint {
  dir: string
  server: Server
  nonce: Buffer
  username: string
  password: string
  target: CredentialTarget
}

const open = new Map<string, Endpoint>()

// Plain CommonJS on purpose: run through `ELECTRON_RUN_AS_NODE` (or node in a
// source checkout), it must load nothing but builtins. Only `get` is answered;
// `store` and `erase` exit at once, so nothing keeps the secret. Any failure
// prints nothing and exits 0 — git then moves on as if this helper had no answer.
const HELPER_SOURCE = `'use strict'
const net = require('node:net')
const [endpoint, nonceVar, action] = process.argv.slice(2)
if (action !== 'get') process.exit(0)
const nonce = process.env[nonceVar] || ''
let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => { input += c; if (input.length > 65536) process.exit(0) })
process.stdin.on('end', () => {
  const req = { nonce }
  for (const line of input.split('\\n')) {
    const i = line.indexOf('=')
    const k = line.slice(0, i)
    if (k === 'protocol' || k === 'host' || k === 'path') req[k] = line.slice(i + 1)
  }
  let out = ''
  const sock = net.connect(endpoint)
  sock.setEncoding('utf8')
  sock.setTimeout(10000, () => sock.destroy())
  sock.on('connect', () => sock.write(JSON.stringify(req) + '\\n'))
  sock.on('data', (d) => { out += d })
  sock.on('error', () => process.exit(0))
  sock.on('close', () => {
    try {
      const r = JSON.parse(out)
      if (typeof r.username === 'string' && typeof r.password === 'string') {
        process.stdout.write('username=' + r.username + '\\npassword=' + r.password + '\\n')
      }
    } catch {}
    process.exit(0)
  })
})
`

/** POSIX single quotes for the helper command, which git runs through `sh` (Git for Windows' too). */
const shQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

/** Whether a request git's helper relayed falls inside `t`. Matches the way git matches `credential.<url>`. */
export function requestInScope(
  t: CredentialTarget,
  req: { protocol?: unknown; host?: unknown; path?: unknown }
): boolean {
  if (req.protocol !== 'https') return false
  if (typeof req.host !== 'string' || req.host.toLowerCase() !== t.host) return false
  if (!t.path) return true
  // git matched the config URL's path itself, but sent us none to check.
  if (req.path === undefined) return !t.pathSent
  if (typeof req.path !== 'string') return false
  const p = req.path.replace(/^\/+/, '')
  return p === t.path || p.startsWith(`${t.path}/`)
}

function answer(ep: Endpoint | undefined, line: string): Record<string, string> {
  if (!ep) return {}
  let req: Record<string, unknown>
  try {
    req = JSON.parse(line) as Record<string, unknown>
  } catch {
    return {}
  }
  const sent = typeof req.nonce === 'string' ? Buffer.from(req.nonce, 'utf8') : Buffer.alloc(0)
  if (sent.length !== ep.nonce.length || !timingSafeEqual(sent, ep.nonce)) return {}
  if (!requestInScope(ep.target, req)) return {}
  return { username: ep.username, password: ep.password }
}

function serve(id: string, sock: Socket): void {
  let buf = ''
  sock.setEncoding('utf8')
  sock.setTimeout(5000, () => sock.destroy())
  sock.on('error', () => undefined)
  sock.on('data', (d: string) => {
    buf += d
    if (buf.length > 16384) return void sock.destroy()
    const nl = buf.indexOf('\n')
    if (nl < 0) return
    sock.end(JSON.stringify(answer(open.get(id), buf.slice(0, nl))) + '\n')
  })
}

let exitHook = false

/**
 * Where the endpoint's directory goes. A Unix socket path is capped at about
 * 104 bytes (macOS) and a long TMPDIR can pass that; `/tmp` is then used —
 * safe, since the directory itself is created 0700 by mkdtemp.
 */
function socketParent(): string {
  const base = tmpdir()
  return process.platform !== 'win32' && Buffer.byteLength(join(base, 'gitcito-cred-XXXXXX', 's')) > 100 ? '/tmp' : base
}

/**
 * Open an endpoint answering `cred` for `target`. Returns the helper command for
 * `credential.<url>.helper` and the environment its nonce rides in; neither
 * holds the secret. Synchronous: a Unix socket or pipe is bound before
 * `listen` returns, so the endpoint is up before any git can ask it.
 */
export function openCredentialEndpoint(
  cred: { username: string; password: string },
  target: CredentialTarget,
  index: number
): { helper: string; env: NodeJS.ProcessEnv } {
  const dir = mkdtempSync(join(socketParent(), 'gitcito-cred-'))
  try {
    const id = randomBytes(16).toString('hex')
    // The id leads, so release can find the endpoint from the environment alone.
    const nonce = `${id}.${randomBytes(32).toString('hex')}`
    const endpoint = process.platform === 'win32' ? `\\\\.\\pipe\\gitcito-cred-${id}` : join(dir, 's')
    const script = join(dir, 'helper.cjs')
    writeFileSync(script, HELPER_SOURCE, { mode: 0o600, flag: 'wx' })
    const server = createServer((sock) => serve(id, sock))
    server.on('error', () => undefined)
    server.listen(endpoint)
    // Bound synchronously, so a failure is known here — and a helper that cannot
    // connect would only surface as git's opaque "could not read Username".
    if (!server.listening) throw new Error(`Could not open a credential endpoint for git at ${endpoint}.`)
    // Never what keeps the app (or a test run) alive.
    server.unref()
    open.set(id, { dir, server, nonce: Buffer.from(nonce, 'utf8'), ...cred, target })
    if (!exitHook) {
      exitHook = true
      process.once('exit', () => {
        for (const ep of open.values()) rmSync(ep.dir, { recursive: true, force: true })
      })
    }
    const nonceVar = `${CREDENTIAL_NONCE_VAR}_${index}`
    // The run-as-node switch is set for the helper alone, not for git: in git's
    // environment it would turn any Electron app a hook starts into plain Node.
    const helper =
      `!ELECTRON_RUN_AS_NODE=1 ${shQuote(process.execPath)} ${shQuote(script)} ${shQuote(endpoint)} ${nonceVar}`
    return { helper, env: { [nonceVar]: nonce } }
  } catch (err) {
    rmSync(dir, { recursive: true, force: true })
    throw err
  }
}

/**
 * Close every endpoint whose nonce `env` carries: the socket stops accepting,
 * and its directory — socket and helper script — is removed. Call it once the
 * git run that `env` was built for has exited. Safe to call twice, or with null.
 */
export function releaseCredentialEnv(env: NodeJS.ProcessEnv | null | undefined): void {
  if (!env) return
  for (const [k, v] of Object.entries(env)) {
    if (!k.startsWith(`${CREDENTIAL_NONCE_VAR}_`) || !v) continue
    const id = v.split('.')[0]
    const ep = open.get(id)
    if (!ep) continue
    open.delete(id)
    ep.server.close()
    rmSync(ep.dir, { recursive: true, force: true })
  }
}

/**
 * The credentials the endpoints named in `env` serve, with their scope. Main
 * already holds them; this lets a test say which account an environment signs
 * in as without running git.
 */
export function credentialsInEnv(
  env: NodeJS.ProcessEnv | null | undefined
): Array<{ username: string; password: string; target: CredentialTarget }> {
  const out: Array<{ username: string; password: string; target: CredentialTarget }> = []
  for (const [k, v] of Object.entries(env ?? {})) {
    if (!k.startsWith(`${CREDENTIAL_NONCE_VAR}_`) || !v) continue
    const ep = open.get(v.split('.')[0])
    if (ep) out.push({ username: ep.username, password: ep.password, target: ep.target })
  }
  return out
}

/** How many endpoints are open — for tests that check nothing outlives its run. */
export function openCredentialEndpoints(): number {
  return open.size
}
