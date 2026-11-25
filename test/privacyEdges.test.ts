import { describe, it, expect, vi, afterAll } from 'vitest'
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { serverDisplayAddress, serverUrlWithoutSecrets } from '../src/shared/serverAddress'
import { scrubServerUrls } from '../src/shared/secrets'
import { gitlabServerUrlProblem, instanceUrlProblem } from '../src/shared/gitlabInstance'
import { redactSecrets } from '../src/shared/redact'
import { redactForReport } from '../src/renderer/src/lib/issueReport'
import {
  boundNoCredentialMessage,
  githubCredentialMessage,
  noLinkedAccountMessage
} from '../src/main/hosting'

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-privacy-edges-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  net: {},
  session: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: { isAsyncEncryptionAvailable: async () => false }
}))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('a saved server address loses its secrets, and keeps its host', () => {
  it('an @ in the query or fragment is not a userinfo', () => {
    expect(serverUrlWithoutSecrets('https://gl.corp/gitlab?next=a@evil.example')).toBe('https://gl.corp/gitlab')
    expect(serverUrlWithoutSecrets('https://u@gl.corp/p?q=@x/y')).toBe('https://gl.corp/p')
    expect(serverUrlWithoutSecrets('https://gl.corp#@evil.example')).toBe('https://gl.corp')
    expect(serverDisplayAddress('https://gl.corp/gitlab?next=a@evil.example')).toBe('gl.corp/gitlab')
  })

  it('an @ in a plain path keeps the host it follows', () => {
    expect(serverUrlWithoutSecrets('https://gl.corp/team@x/y?z')).toBe('https://gl.corp/team@x/y')
  })

  it('a password with a slash still goes, as before', () => {
    expect(serverUrlWithoutSecrets('https://u:pa/ss@h.example/ctx')).toBe('https://h.example/ctx')
    expect(serverUrlWithoutSecrets('jdoe:a/b/c@bbs.corp:7990')).toBe('bbs.corp:7990')
    expect(serverUrlWithoutSecrets('https://u:p@ss:/w@rd@bbs.corp/b')).toBe('https://bbs.corp/b')
  })

  it('nothing left of the host is no address at all — never `https://`, which `new URL` throws on', () => {
    for (const raw of ['https://gl.corp@', 'https://u:p@', 'https://?x=1', 'https://#frag', 'https://u@:443/x']) {
      expect(serverUrlWithoutSecrets(raw), raw).toBe('')
    }
  })

  it('scrubbing a profile stores the empty address, never the credential', () => {
    const scrubbed = scrubServerUrls({
      profiles: [{ githubEnterprise: [{ url: 'https://jane:hunter2@', token: '' }], forgejoUrl: 'https://x?next=a@evil.example' }]
    })
    const out = JSON.stringify(scrubbed)
    expect(out).not.toMatch(/hunter2|evil/)
    expect(scrubbed.profiles).toEqual([{ githubEnterprise: [{ url: '', token: '' }], forgejoUrl: 'https://x' }])
  })
})

describe('a typed Forgejo address is checked like a self-managed GitLab', () => {
  it('refuses a user name, a query, a fragment and plain http', () => {
    expect(instanceUrlProblem('https://jane:tok@forge.corp')).toBe('credentials')
    expect(instanceUrlProblem('https://@forge.corp')).toBe('credentials')
    expect(instanceUrlProblem('https://forge.corp/?access_token=x')).toBe('query')
    expect(instanceUrlProblem('https://forge.corp?')).toBe('query')
    expect(instanceUrlProblem('https://forge.corp#x')).toBe('query')
    expect(instanceUrlProblem('http://forge.corp')).toBe('http')
    expect(instanceUrlProblem('https://')).toBe('invalid')
  })

  it('accepts a bare host, a port and a path', () => {
    for (const ok of ['forge.corp', 'https://forge.corp:3000', 'https://corp.example/forgejo/']) {
      expect(instanceUrlProblem(ok), ok).toBeNull()
    }
  })

  it('the GitLab check keeps its own gitlab.com refusal on top', () => {
    expect(gitlabServerUrlProblem('https://gitlab.com')).toBe('gitlabCom')
    expect(instanceUrlProblem('https://gitlab.com')).toBeNull()
    expect(gitlabServerUrlProblem('https://u@gl.corp')).toBe('credentials')
  })
})

describe('an issue report keeps nothing private', () => {
  const PRIVATE = /jane|\bdoe\b|buildbox|acme|2001:db8|fe80|fd00|ab12cd|abcdefABCDEF|ASIAAB|AKIAAB|xai-ab|5xk3uw|xoxb|gitlab-internal/i
  const cases: [string, string][] = [
    ["fatal: '/Users/Jane Doe/work/app' does not appear to be a git repository", "fatal: '~/work/app' does not appear to be a git repository"],
    ['C:\\Users\\Jane Doe\\work\\app: not found', '~\\work\\app: not found'],
    ['C:/Users/jane/work/app: not found', '~/work/app: not found'],
    ['/home/jane: not found', '~: not found'],
    ['error: open("/home/jane doe/src/.git/index.lock"): File exists', 'error: open("~/src/.git/index.lock"): File exists'],
    ['Permission denied (publickey) for jane@buildbox', 'Permission denied (publickey) for <user>@<host>'],
    ['getaddrinfo ENOTFOUND gitlab-internal', 'getaddrinfo ENOTFOUND <host>'],
    ['getaddrinfo EAI_AGAIN buildbox', 'getaddrinfo EAI_AGAIN <host>'],
    ['Failed to connect to [2001:db8::5] port 443', 'Failed to connect to <ip> port 443'],
    ['Failed to connect to fd00::12 port 3000 after 2 ms', 'Failed to connect to <ip> port 3000 after 2 ms'],
    ['link-local fe80::1%eth0 unreachable', 'link-local <ip> unreachable'],
    ['ghe.Acme.corp unreachable', '<host> unreachable'],
    ['Gitlab.Internal.Example unreachable', '<host> unreachable'],
    ['Azure DevOps organization "acme-org" was not found (404).', 'Azure DevOps organization "<org>" was not found (404).'],
    ["profile 'Jane Doe' has no token", "profile '<profile>' has no token"],
    ['The profile “Jane Doe” has no token', 'The profile “<profile>” has no token'],
    ['access_token=ab12cd34ef56gh78ij90kl12mn34op56 rejected', 'access_token=<redacted> rejected'],
    ['x-access-token: abcdefABCDEF0123456789abcdef', 'x-access-token: <redacted>'],
    ['xai-abcdefghijklmnopqrstu1234567890 rejected', '<redacted> rejected'],
    ['AWS bedrock ASIAABCDEFGHIJKLMNOP', 'AWS bedrock <redacted>'],
    ['key AKIAABCDEFGHIJKLMNOP', 'key <redacted>'],
    ['Azure PAT: 5xk3uwhh6qx4c2ol3n5hj2fb6w5zrkxgdp7o6pvd7ojnxcpqrzzq', 'Azure PAT: <redacted>'],
    ['slack xoxb-1234567890-abcdefghij said no', 'slack <redacted> said no']
  ]

  it.each(cases)('%s', (input, expected) => {
    const out = redactForReport(input)
    expect(out).toBe(expected)
    expect(out).not.toMatch(PRIVATE)
  })

  it("main's Azure organisation message, from its own wording", () => {
    const msg =
      'Azure DevOps rejected the credential (401). Check that it is valid and not expired, that it has access to the "acme-org" organization, and that the organization name is spelled correctly.'
    expect(redactForReport(msg)).toContain('has access to the "<org>" organization')
  })

  it("main's builders, with a single-label host and a profile name with spaces", () => {
    for (const m of [
      noLinkedAccountMessage('forgejo', 'buildbox'),
      githubCredentialMessage('missing', 'ghe.Acme.corp'),
      boundNoCredentialMessage('gitlab', 'Jane Doe', 'buildbox:8443')
    ]) {
      expect(redactForReport(m), m).not.toMatch(PRIVATE)
    }
  })

  it('leaves ordinary messages, times, code and file paths alone', () => {
    for (const text of [
      'error: pathspec \'feature/x\' did not match any file(s) known to git',
      'at 12:30:45 the push finished',
      'mac aa:bb:cc:dd:ee:ff',
      'std::vector<int> and a::b',
      'HEAD@{1}: checkout: moving from main to dev',
      'Object.is and Electron.App and Pattern.test and React.Children.map',
      'litellm.InternalServerError: AsyncCompletions.create() failed',
      '/usr/local/bin/git: not found',
      '/home/: nothing here',
      'password: required',
      'the api_key field is empty',
      'branch feature-xai-support merged',
      'commit 4e5d579b2c0d7e8f1a2b3c4d5e6f708192a3b4c5'
    ]) {
      expect(redactForReport(text), text).toBe(text)
    }
  })
})

describe('the shared redaction (op log, toasts) knows the new token shapes', () => {
  it('masks them', () => {
    for (const secret of [
      'xai-abcdefghijklmnopqrstu1234567890',
      'AKIAABCDEFGHIJKLMNOP',
      'xoxp-1234567890-abcdefghij',
      '5xk3uwhh6qx4c2ol3n5hj2fb6w5zrkxgdp7o6pvd7ojnxcpqrzzq',
      `${'A1b2C3d4'.repeat(9)}abcdAZDOwxyz`
    ]) {
      expect(redactSecrets(`push failed: ${secret}`), secret).toBe('push failed: ***')
    }
  })

  it('leaves a commit hash and a long branch name alone', () => {
    const text = 'abcdef0123456789abcdef0123456789abcdef01 feature/a-very-long-branch-name-without-any-secret-in-it'
    expect(redactSecrets(text)).toBe(text)
  })
})

describe.skipIf(process.platform === 'win32')('the other files in the user-data folder are owner-only', () => {
  const mode = (f: string): number => statSync(f).mode & 0o777
  const call = (channel: string, ...args: unknown[]): Promise<unknown> => Promise.resolve(handlers.get(channel)!({}, ...args))

  it('githuttbr-info.json — keyed by repository paths — new, and one written world-readable', async () => {
    const file = join(dir, 'githuttbr-info.json')
    writeFileSync(file, JSON.stringify({ repos: {} }))
    chmodSync(file, 0o644)
    const { registerInfoHandlers } = await import('../src/main/info')
    registerInfoHandlers()
    await call('info:upsert', '/home/jane/secret-project', { id: 'a', kind: 'note', title: 't', body: 'b' })
    expect(readFileSync(file, 'utf8')).toContain('secret-project')
    expect(mode(file)).toBe(0o600)
  })

  it('githuttbr-keychain.json', async () => {
    const { setConsent } = await import('../src/main/keychain')
    await setConsent('declined')
    expect(mode(join(dir, 'githuttbr-keychain.json'))).toBe(0o600)
  })

  it('githuttbr-repos.json', async () => {
    const file = join(dir, 'githuttbr-repos.json')
    writeFileSync(file, '[]')
    chmodSync(file, 0o644)
    const { forgetRepo } = await import('../src/main/repoRegistry')
    await forgetRepo('/nowhere')
    expect(mode(file)).toBe(0o600)
  })

  it('githuttbr-analytics.json', async () => {
    const { recordEvent } = await import('../src/main/analytics')
    await recordEvent('commit')
    await new Promise((r) => setTimeout(r, 700))
    expect(mode(join(dir, 'githuttbr-analytics.json'))).toBe(0o600)
  })

  it('no module that keeps a file in the user-data folder writes it with the default umask', () => {
    for (const name of ['info', 'repoRegistry', 'aiModels', 'keychain', 'analytics', 'vault', 'profileAvatar']) {
      const src = readFileSync(join(__dirname, '..', 'src', 'main', `${name}.ts`), 'utf8')
      expect(src, name).not.toMatch(/\bwriteFile\(/)
      expect(src, name).toMatch(/writePrivateFile\(/)
    }
    // wiki.ts writes pages into the repository too; only its store is owner-only.
    const wiki = readFileSync(join(__dirname, '..', 'src', 'main', 'wiki.ts'), 'utf8')
    expect(wiki).toContain('writePrivateFile(filePath(),')
  })
})
