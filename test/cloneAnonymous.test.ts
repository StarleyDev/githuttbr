import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { chmodSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { anonymousGitEnv } from '../src/main/gitCredentialEnv'
import { gitService } from '../src/main/git'
import { credentialConfig } from './credentialConfig'

// A clone for a picked profile that has no credential must be anonymous. Left to
// git, "the machine" — a credential manager holding another account's login for
// the host — answers, and the repository is bound to the picked profile while
// cloned as someone else. Real git, a fake machine in a temp HOME.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-anon-'))
const marker = join(dir, 'helper-was-asked')
const askpassMarker = join(dir, 'askpass-was-run')

beforeAll(() => {
  const helper = join(dir, 'machine-helper.sh')
  writeFileSync(helper, `#!/bin/sh\ntouch '${marker}'\ntest "$1" = get && printf 'username=machine-user\\npassword=machine-secret\\n'\nexit 0\n`)
  chmodSync(helper, 0o755)
  const askpass = join(dir, 'askpass.sh')
  writeFileSync(askpass, `#!/bin/sh\ntouch '${askpassMarker}'\necho machine-secret\n`)
  chmodSync(askpass, 0o755)
  // Both a host-wide and a URL-specific helper, and an askpass in config.
  writeFileSync(
    join(dir, 'gitconfig'),
    `[credential]\n\thelper = ${helper}\n[credential "http://127.0.0.1"]\n\thelper = ${helper}\n` +
      `[credential "https://github.com"]\n\thelper = ${helper}\n[core]\n\taskPass = ${askpass}\n`
  )
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const machineEnv = (): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH,
  HOME: dir,
  GIT_CONFIG_GLOBAL: join(dir, 'gitconfig'),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
  SSH_ASKPASS: join(dir, 'askpass.sh')
})

const reset = (): void => {
  rmSync(marker, { force: true })
  rmSync(askpassMarker, { force: true })
}

const fillPath = (env: NodeJS.ProcessEnv, path: string): string => {
  try {
    return execFileSync('git', ['credential', 'fill'], {
      input: `protocol=https\nhost=github.com\npath=${path}\n\n`,
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch {
    return ''
  }
}

const fill = (env: NodeJS.ProcessEnv, host = 'github.com'): string => {
  try {
    return execFileSync('git', ['credential', 'fill'], {
      input: `protocol=https\nhost=${host}\npath=acme/widgets.git\n\n`,
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch {
    return ''
  }
}

describe('anonymousGitEnv against real git', () => {
  afterEach(reset)

  it('control: without it, the machine helper answers', () => {
    expect(fill(machineEnv())).toContain('password=machine-secret')
    expect(existsSync(marker)).toBe(true)
  })

  it('with it, no configured helper or askpass is run and nothing is filled', () => {
    const base = machineEnv()
    const env = { ...base, ...anonymousGitEnv('https://github.com/acme/widgets.git', base) }
    expect(fill(env)).not.toContain('machine-secret')
    expect(existsSync(marker)).toBe(false)
    expect(existsSync(askpassMarker)).toBe(false)
  })

  it('appends to config the environment already carries instead of replacing it', () => {
    const base = {
      ...machineEnv(),
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'user.name',
      GIT_CONFIG_VALUE_0: 'kept',
      GIT_CONFIG_PARAMETERS: "'user.email=kept@example.com'"
    }
    const extra = anonymousGitEnv('https://github.com/x.git', base)!
    // `git -c`'s own variable, so git older than 2.31 honours it too; the
    // config-from-environment entries are left alone.
    expect(extra.GIT_CONFIG_COUNT).toBeUndefined()
    expect(extra.GIT_CONFIG_PARAMETERS).toBe(
      "'user.email=kept@example.com' 'credential.https://github.com.helper=' 'credential.https://github.com.useHttpPath=true'"
    )
    const env = { ...base, ...extra }
    expect(execFileSync('git', ['config', 'user.name'], { env, encoding: 'utf8' }).trim()).toBe('kept')
    expect(execFileSync('git', ['config', 'user.email'], { env, encoding: 'utf8' }).trim()).toBe('kept@example.com')
    expect(fill(env)).not.toContain('machine-secret')
  })

  it('a server scope blanks the helpers under its base only', () => {
    const base = machineEnv()
    const scope = { prefix: 'https://github.com/acme' }
    for (const configCount of [false, true]) {
      const env = { ...base, ...anonymousGitEnv('https://github.com/acme/widgets.git', base, scope, { configCount }) }
      expect(fill(env)).not.toContain('machine-secret')
      expect(existsSync(marker)).toBe(false)
      // Another repository under the base, as after a redirect: still nobody.
      expect(fillPath(env, 'acme/widgets')).not.toContain('machine-secret')
      // Outside the base, on the same host: left to git, as before.
      expect(fillPath(env, 'other/repo.git')).toContain('password=machine-secret')
      reset()
    }
  })

  // The old `'key=value'` form splits at the first `=`, and a URL path keeps
  // `= ! $ ; '` raw: a path holding `.helper=!cmd` made the rest the value of
  // a `credential.<url>.helper`, run as a shell command on the first 401.
  it('nothing a URL path holds reaches the key: no command runs, one empty helper entry', () => {
    const pwned = join(dir, 'pwned')
    const hostile = [
      `/o/r.helper=!touch$IFS${pwned};.git`,
      `/o/r.helper=!touch$IFS${pwned}`,
      `/o/r/.helper=!touch$IFS${pwned}`,
      "/o/it's;$HOME!=x.git",
      '/o/with space/and%20percent%3D/r.git',
      '/o/%41%2F%3D%27/r.git'
    ]
    for (const path of hostile) {
      const url = `https://github.com${path}`
      const base = machineEnv()
      for (const scope of ['host', { prefix: 'https://github.com/o' }] as const) {
        for (const configCount of [false, true]) {
          const extra = anonymousGitEnv(url, base, scope, { configCount })
          expect(extra, path).not.toBeNull()
          const context = scope === 'host' ? 'https://github.com' : 'https://github.com/o'
          expect(credentialConfig(extra), path).toEqual([
            `credential.${context}.helper`,
            `credential.${context}.usehttppath true`
          ])
          const env = { ...base, ...extra }
          expect(fillPath(env, new URL(url).pathname.slice(1))).not.toContain('machine-secret')
          expect(readdirSync(dir).filter((f) => f.startsWith('pwned')), path).toEqual([])
          expect(existsSync(marker), path).toBe(false)
        }
      }
    }
  })

  it('a configured base is encoded too, and a line break or a hostile host is refused', () => {
    const extra = anonymousGitEnv('https://h.example/a=b!c/r.git', {}, { prefix: 'https://h.example/a=b!c' })
    expect(credentialConfig(extra)).toContain('credential.https://h.example/a%3Db%21c.helper')
    expect(anonymousGitEnv('https://github.com/a\n/b.git')).toBeNull()
    expect(anonymousGitEnv('https://github.com/a\r/b.git')).toBeNull()
    expect(anonymousGitEnv('https://x.helper=!id/r.git')).toBeNull()
    expect(anonymousGitEnv('https://h.example/%zz/r.git', {}, { prefix: 'https://h.example' })).toBeNull()
  })

  it('has nothing to say for a URL with no credential step', () => {
    expect(anonymousGitEnv('git@github.com:acme/x.git')).toBeNull()
    expect(anonymousGitEnv('/some/local/path')).toBeNull()
  })
})

describe('a clone-dialog ls-remote and a clone for a picked profile with no credential', () => {
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
    reset()
  })

  const asMachine = (): void => {
    Object.assign(process.env, machineEnv())
  }

  it('control: no profile named — git asks the machine, as a terminal clone would', async () => {
    asMachine()
    await expect(gitService.remoteBranches(`http://127.0.0.1:${port}/team/app.git`)).rejects.toThrow()
    expect(received).toContain('machine-user:machine-secret')
  })

  // Clone → URL has no host: a pasted address no profile serves is the user's
  // own business, and the machine's helper may be the only way in.
  it('Clone → URL for a server no profile serves: git’s helper still answers', async () => {
    asMachine()
    await expect(
      gitService.remoteBranches(`http://127.0.0.1:${port}/team/app.git`, undefined, undefined, 'gone')
    ).rejects.toThrow()
    expect(received).toContain('machine-user:machine-secret')
  })

  it('a named profile with nothing to offer: ls-remote reaches the server as nobody', async () => {
    asMachine()
    await expect(
      gitService.remoteBranches(`http://127.0.0.1:${port}/team/app.git`, 'github', undefined, 'gone')
    ).rejects.toThrow()
    expect(received.length).toBeGreaterThan(0)
    expect(received.every((r) => r === '')).toBe(true)
    expect(existsSync(marker)).toBe(false)
    expect(existsSync(askpassMarker)).toBe(false)
  })

  it('a named profile with nothing to offer: the clone reaches the server as nobody', async () => {
    asMachine()
    const parent = mkdtempSync(join(dir, 'clone-'))
    await expect(
      gitService.clone(parent, `http://127.0.0.1:${port}/team/app.git`, 'app', { host: 'github', profileId: '' })
    ).rejects.toThrow()
    expect(received.length).toBeGreaterThan(0)
    expect(received.every((r) => r === '')).toBe(true)
    expect(existsSync(marker)).toBe(false)
  })
})
