import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitService } from '../src/main/git'

// Going anonymous must not need git 2.31. Ubuntu 20.04 ships 2.25 and Debian 11
// 2.30: refusing there turned the clone of a public repository, for a picked
// profile without a token, into "needs git 2.31". The git on PATH here claims
// to be 2.25 and, like it, ignores GIT_CONFIG_COUNT — so a blanking that relied
// on config-from-environment would let the machine's helper answer.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-old-git-'))
const bin = join(dir, 'bin')
const marker = join(dir, 'helper-was-asked')
const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim()

beforeAll(() => {
  mkdirSync(bin)
  writeFileSync(
    join(bin, 'git'),
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "git version 2.25.1"; exit 0; fi\n` +
      // What git before 2.31 does with config-from-environment: nothing.
      `unset GIT_CONFIG_COUNT\nexec '${realGit}' "$@"\n`
  )
  chmodSync(join(bin, 'git'), 0o755)
  const helper = join(dir, 'machine-helper.sh')
  writeFileSync(helper, `#!/bin/sh\ntouch '${marker}'\ntest "$1" = get && printf 'username=machine-user\\npassword=machine-secret\\n'\nexit 0\n`)
  chmodSync(helper, 0o755)
  writeFileSync(join(dir, 'gitconfig'), `[credential]\n\thelper = ${helper}\n`)
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('a clone as nobody on git older than 2.31', () => {
  let server: Server
  let port = 0
  const received: string[] = []
  const saved = { ...process.env }

  beforeAll(async () => {
    server = createServer((req, res) => {
      const auth = req.headers.authorization
      received.push(auth ? Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString() : '')
      res.writeHead(auth ? 403 : 401, auth ? {} : { 'WWW-Authenticate': 'Basic realm="test"' })
      res.end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
  })

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  afterEach(() => {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
    Object.assign(process.env, saved)
    received.length = 0
    rmSync(marker, { force: true })
  })

  const asOldMachine = (): void => {
    Object.assign(process.env, {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: dir,
      GIT_CONFIG_GLOBAL: join(dir, 'gitconfig'),
      GIT_CONFIG_NOSYSTEM: '1'
    })
  }

  it('the fake really is an old git', () => {
    asOldMachine()
    expect(execFileSync('git', ['--version'], { encoding: 'utf8' })).toContain('2.25')
  })

  it('the branch list runs, as nobody, instead of refusing for the git version', async () => {
    asOldMachine()
    const err = await gitService
      .remoteBranches(`http://127.0.0.1:${port}/team/app.git`, 'github', undefined, 'gone')
      .then(() => null, (e: Error) => e)
    expect(err?.message ?? '').not.toMatch(/2\.31/)
    // It reached the server — and as nobody, the machine's helper unasked.
    expect(received.length).toBeGreaterThan(0)
    expect(received.every((r) => r === '')).toBe(true)
    expect(existsSync(marker)).toBe(false)
  })

  it('the clone runs, as nobody, instead of refusing for the git version', async () => {
    asOldMachine()
    const parent = mkdtempSync(join(dir, 'clone-'))
    const err = await gitService
      .clone(parent, `http://127.0.0.1:${port}/team/app.git`, 'app', { host: 'github', profileId: '' })
      .then(() => null, (e: Error) => e)
    expect(err?.message ?? '').not.toMatch(/2\.31/)
    expect(received.length).toBeGreaterThan(0)
    expect(received.every((r) => r === '')).toBe(true)
    expect(existsSync(marker)).toBe(false)
  })

  // A token still needs config-from-environment: old git would run without it
  // and fail with "could not read Username", so the reason is given instead.
  it('a clone with a token still says which git it needs', async () => {
    asOldMachine()
    await expect(
      gitService.remoteBranches('https://github.com/team/app.git', 'github', 'some-token')
    ).rejects.toThrow(/git 2\.31 or newer/)
  })
})
