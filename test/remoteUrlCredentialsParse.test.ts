import { describe, it, expect } from 'vitest'
import {
  parseRemoteUrlConfig,
  readUrlUserinfo,
  remoteUrlCredentialsFrom,
  passwordRewrites,
  urlWithoutPassword
} from '../src/shared/remoteUrlCredentials'
import { ownerFromRemoteUrl } from '../src/main/repoMeta'
import { isAuthFailureMessage, removalConfirmPlan, remoteToBlameForAuthFailure } from '../src/renderer/src/lib/remoteUrlCredentials'
import { explainGitError } from '../src/renderer/src/lib/gitErrorHint'
import type { RemoteUrlCredentials } from '../src/shared/types'

// Fictional hosts and a fake token only.
const TOKEN = 'fake-token-0000'

describe('readUrlUserinfo', () => {
  it('reports a password in an https URL and removes the whole userinfo', () => {
    const r = readUrlUserinfo(`https://someone:${TOKEN}@git.example.test/team/app.git`)
    expect(r.kind).toBe('password')
    expect(r.clean).toBe('https://git.example.test/team/app.git')
    expect(r.withoutPassword).toBe('https://someone@git.example.test/team/app.git')
  })

  it('reports a user name alone as harmless, and keeps it when only the password goes', () => {
    const r = readUrlUserinfo('https://someone@git.example.test/team/app.git')
    expect(r.kind).toBe('username')
    expect(r.clean).toBe('https://git.example.test/team/app.git')
    expect(r.withoutPassword).toBe('https://someone@git.example.test/team/app.git')
  })

  it('treats an empty password as a user name', () => {
    expect(readUrlUserinfo('https://someone:@git.example.test/a.git').kind).toBe('username')
  })

  it('handles percent-encoded userinfo without decoding it', () => {
    const r = readUrlUserinfo('https://someone%40corp:p%40ss%2Fword@git.example.test/a.git')
    expect(r.kind).toBe('password')
    expect(r.clean).toBe('https://git.example.test/a.git')
    expect(r.withoutPassword).toBe('https://someone%40corp@git.example.test/a.git')
  })

  it('splits at the last @ of the authority, for an unencoded @ in the password', () => {
    const r = readUrlUserinfo('https://someone:p@ss@git.example.test/a.git')
    expect(r.kind).toBe('password')
    expect(r.clean).toBe('https://git.example.test/a.git')
  })

  it('flags a password with an unencoded slash as ambiguous: redacted, never rewritten', () => {
    const url = 'https://someone:pa/ss@git.example.test/team/app.git'
    const r = readUrlUserinfo(url)
    expect(r).toMatchObject({ kind: 'password', ambiguous: true, clean: url })
    expect(r.withoutPassword).not.toContain('pa/ss')
    expect(r.valuePattern).toBeUndefined()
  })

  it('flags an @ in the user name plus a slash in the password as ambiguous', () => {
    const r = readUrlUserinfo('https://me@corp.example:ab/cd@git.example.test/repo.git')
    expect(r.kind).toBe('password')
    expect(r.ambiguous).toBe(true)
    expect(r.withoutPassword).not.toMatch(/ab\/cd|ab\b/)
  })

  it('ends the authority at ? # and \\, and calls an @ past them ambiguous', () => {
    // git sends this to 127.0.0.1; cutting at the last @ would move it to another host.
    const tricky = 'http://u:p@127.0.0.1#@evil.example.test/x'
    const r = readUrlUserinfo(tricky)
    expect(r).toMatchObject({ kind: 'password', ambiguous: true, clean: tricky })
    expect(r.withoutPassword).not.toContain('u:p')
    expect(readUrlUserinfo('http://u:p@127.0.0.1?@evil.example.test/x').ambiguous).toBe(true)
    expect(readUrlUserinfo('http://u:p@127.0.0.1\\@evil.example.test/x').ambiguous).toBe(true)
    // No password before the `?`: nothing to report.
    expect(readUrlUserinfo('https://git.example.test?q=a@b').kind).toBeNull()
    // A `?` with no `@` after it: an ordinary password, cut before the query.
    expect(readUrlUserinfo(`https://u:${TOKEN}@git.example.test?x=1`).clean).toBe('https://git.example.test?x=1')
  })

  it('never reads the path of a bracketed IPv6 host as a userinfo', () => {
    const url = 'https://[fd00::1]:8443/team/app@v2.git'
    expect(readUrlUserinfo(url)).toMatchObject({ kind: null, clean: url, withoutPassword: url })
    const r = readUrlUserinfo(`https://u:${TOKEN}@[fd00::1]:8443/team/app@v2.git`)
    expect(r).toMatchObject({ kind: 'password', ambiguous: false, clean: 'https://[fd00::1]:8443/team/app@v2.git' })
  })

  it('reads past a transport prefix and keeps it', () => {
    const r = readUrlUserinfo(`persistent-https::https://u:${TOKEN}@git.example.test/a.git`)
    expect(r.kind).toBe('password')
    expect(r.clean).toBe('persistent-https::https://git.example.test/a.git')
    expect(r.withoutPassword).toBe('persistent-https::https://u@git.example.test/a.git')
    expect(urlWithoutPassword(`gcrypt::https://u:${TOKEN}@git.example.test/a.git`)).not.toContain(TOKEN)
    expect(readUrlUserinfo('gcrypt::git@git.example.test:team/app.git').kind).toBeNull()
  })

  it('keeps a port and an @ in the path for what they are', () => {
    expect(readUrlUserinfo('https://git.example.test:8443/a@b/app.git').kind).toBeNull()
    const r = readUrlUserinfo(`https://someone:${TOKEN}@git.example.test:8443/team/app.git`)
    expect(r.clean).toBe('https://git.example.test:8443/team/app.git')
  })

  it('handles an IPv6 host', () => {
    const r = readUrlUserinfo(`https://someone:${TOKEN}@[2001:db8::1]:8443/team/app.git`)
    expect(r.kind).toBe('password')
    expect(r.clean).toBe('https://[2001:db8::1]:8443/team/app.git')
    expect(readUrlUserinfo('https://[2001:db8::1]/team/app.git').kind).toBeNull()
  })

  it('ignores the user name of ssh URLs, and keeps it when a password goes', () => {
    expect(readUrlUserinfo('ssh://git@git.example.test/team/app.git').kind).toBeNull()
    expect(readUrlUserinfo('git+ssh://git@git.example.test:2222/team/app.git').kind).toBeNull()
    const r = readUrlUserinfo(`ssh://git:${TOKEN}@git.example.test/team/app.git`)
    expect(r.kind).toBe('password')
    expect(r.clean).toBe('ssh://git@git.example.test/team/app.git')
  })

  it('ignores scp-like ssh and local paths', () => {
    for (const u of ['git@git.example.test:team/app.git', '/srv/repos/app.git', '../app.git', 'C:\\repos\\app']) {
      const r = readUrlUserinfo(u)
      expect(r.kind).toBeNull()
      expect(r.clean).toBe(u)
      expect(r.withoutPassword).toBe(u)
    }
  })

  it('keeps every other byte as written', () => {
    expect(urlWithoutPassword('HTTPS://Someone:x@Git.Example.Test/Team/App%20One.git')).toBe(
      'HTTPS://Someone@Git.Example.Test/Team/App%20One.git'
    )
    expect(urlWithoutPassword('https://git.example.test/a.git')).toBe('https://git.example.test/a.git')
  })
})

describe('remote URL config', () => {
  const raw = [
    `remote.origin.url\nhttps://someone:${TOKEN}@git.example.test/team/app.git`,
    `remote.origin.pushurl\nhttps://someone:${TOKEN}@git.example.test/team/app.git`,
    'remote.origin.pushurl\nhttps://mirror.example.test/team/app.git',
    'remote.team.mirror.url\nhttps://reader@mirror.example.test/team/app.git',
    'remote.upstream.url\ngit@git.example.test:team/app.git',
    ''
  ].join('\0')

  it('parses per remote, names with dots included, in file order', () => {
    const m = parseRemoteUrlConfig(raw)
    expect([...m.keys()]).toEqual(['origin', 'team.mirror', 'upstream'])
    expect(m.get('origin')?.push).toHaveLength(2)
    expect(m.get('team.mirror')?.fetch).toEqual(['https://reader@mirror.example.test/team/app.git'])
  })

  it('reports only remotes with something in their URLs, and never the secret', () => {
    const creds = remoteUrlCredentialsFrom(parseRemoteUrlConfig(raw))
    expect(creds.map((c) => [c.remote, c.kind])).toEqual([
      ['origin', 'password'],
      ['team.mirror', 'username']
    ])
    expect(creds[0].urls.map((u) => u.role)).toEqual(['fetch', 'push'])
    expect(JSON.stringify(creds)).not.toContain(TOKEN)
    expect(JSON.stringify(creds)).not.toContain('someone')
  })

  it('rewrites only the values holding a password, with patterns that never hold it', () => {
    expect(passwordRewrites(['https://a@x.example.test/r', 'https://b@y.example.test/r'])).toEqual([])
    const steps = passwordRewrites([
      `https://u:${TOKEN}@x.example.test/r.git`,
      'https://reader@x.example.test/r.git',
      `https://v:${TOKEN}2@x.example.test/r.git`,
      'https://u:pa/ss@x.example.test/r.git'
    ])
    // Two password variants of one address: one step. The ambiguous one: none.
    expect(steps).toEqual([{ pattern: '^https://[^/]*:[^/]*@x\\.example\\.test/r\\.git$', value: 'https://x.example.test/r.git' }])
    expect(JSON.stringify(steps)).not.toContain(TOKEN)
    const re = new RegExp(steps[0].pattern)
    expect(re.test(`https://u:${TOKEN}@x.example.test/r.git`)).toBe(true)
    expect(re.test('https://reader@x.example.test/r.git')).toBe(false)
    expect(re.test('https://x.example.test/r.git')).toBe(false)
  })

  it('marks a remote with an ambiguous URL as not removable, and shows only its redaction', () => {
    const creds = remoteUrlCredentialsFrom(
      parseRemoteUrlConfig('remote.odd.url\nhttp://u:p@127.0.0.1#@evil.example.test/x\0')
    )
    expect(creds).toHaveLength(1)
    expect(creds[0].removable).toBe(false)
    expect(creds[0].urls[0].ambiguous).toBe(true)
    expect(JSON.stringify(creds)).not.toContain('u:p')
  })
})

describe('the owner read from a remote URL', () => {
  it('never takes part of a token for the owner', () => {
    expect(ownerFromRemoteUrl('https://u:ab/cd@git.example.test/team/app.git')).toBeNull()
    expect(ownerFromRemoteUrl(`https://u:${TOKEN}@git.example.test/team/app.git`)).toBe('team')
    expect(ownerFromRemoteUrl('git@git.example.test:team/app.git')).toBe('team')
  })
})

describe('an authentication failure on a remote with a password in its URL', () => {
  const creds: RemoteUrlCredentials[] = [
    { remote: 'origin', kind: 'password', removable: true, urls: [{ role: 'fetch', kind: 'password', url: 'https://git.example.test/team/app.git' }] },
    { remote: 'fork', kind: 'username', removable: false, urls: [{ role: 'fetch', kind: 'username', url: 'https://git.example.test/me/app.git' }] }
  ]
  // What git prints once main has redacted it.
  const revoked =
    "remote: Invalid username or token. Password authentication is not supported for Git operations.\n" +
    "fatal: Authentication failed for 'https://***@git.example.test/team/app.git/'"

  it('is recognised as an auth failure, and gitErrorHint still explains it', () => {
    expect(isAuthFailureMessage(revoked)).toBe(true)
    expect(isAuthFailureMessage("fatal: unable to access 'https://git.example.test/x/': The requested URL returned error: 403")).toBe(true)
    expect(isAuthFailureMessage('fatal: could not read Username for \'https://git.example.test\'')).toBe(true)
    expect(isAuthFailureMessage('error: failed to push some refs (non-fast-forward)')).toBe(false)
    expect(explainGitError(revoked)?.key).toBe('gitError.noCredential')
    expect(
      explainGitError('Error: The URL of the remote "origin" is ambiguous about its host. Edit the remote by hand.')
    ).toEqual({ key: 'gitError.remoteUrlAmbiguous', vars: { remote: 'origin' } })
  })

  it('blames the remote whose URL holds the password, by the URL git names', () => {
    expect(remoteToBlameForAuthFailure(revoked, creds)).toBe('origin')
  })

  it('blames nobody for a remote that only has a user name, or a URL no remote has', () => {
    const fork = "fatal: Authentication failed for 'https://git.example.test/me/app.git/'"
    expect(remoteToBlameForAuthFailure(fork, creds)).toBeNull()
    const other = "fatal: Authentication failed for 'https://elsewhere.example.test/team/app.git/'"
    expect(remoteToBlameForAuthFailure(other, creds)).toBeNull()
  })

  it('without a URL, falls back to the remote named, or the only one with a password', () => {
    const bare = 'remote: HTTP Basic: Access denied'
    expect(remoteToBlameForAuthFailure(bare, creds)).toBe('origin')
    expect(remoteToBlameForAuthFailure(bare, creds, 'fork')).toBeNull()
    expect(remoteToBlameForAuthFailure(bare, [...creds, { ...creds[0], remote: 'second' }])).toBeNull()
  })

  it('ignores errors that are not about a credential', () => {
    expect(remoteToBlameForAuthFailure("fatal: repository 'https://git.example.test/team/app.git/' not found", creds)).toBeNull()
  })
})

describe('the removal confirmation', () => {
  const creds: RemoteUrlCredentials[] = [
    {
      remote: 'origin',
      kind: 'password',
      removable: true,
      urls: [{ role: 'fetch', kind: 'password', url: 'https://git.example.test:8443/team/app.git' }]
    }
  ]

  it('with a profile token: the plain confirmation, no detour', () => {
    const plan = removalConfirmPlan(creds, 'origin', true)
    expect(plan.addTokenFirst).toBe(false)
    expect(plan.lines.map((l) => l.key)).toEqual([
      'urlCred.confirmMessage',
      'urlCred.confirmUsername',
      'urlCred.confirmNoUndo',
      'urlCred.confirmRevoke'
    ])
  })

  it('without one: the warning first, naming the host, and "Add a token first"', () => {
    const plan = removalConfirmPlan(creds, 'origin', false)
    expect(plan.addTokenFirst).toBe(true)
    expect(plan.lines[0]).toEqual({ key: 'urlCred.noProfileToken', vars: { host: 'git.example.test:8443' } })
    expect(plan.lines).toHaveLength(5)
  })

  it('falls back to the remote name when no clean URL names a host', () => {
    expect(removalConfirmPlan([], 'origin', false).lines[0].vars).toEqual({ host: 'origin' })
  })
})
