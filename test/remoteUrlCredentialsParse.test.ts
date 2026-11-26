import { describe, it, expect } from 'vitest'
import {
  parseRemoteUrlConfig,
  readUrlUserinfo,
  remoteUrlCredentialsFrom,
  urlWithoutPassword,
  urlsWithoutPasswords
} from '../src/shared/remoteUrlCredentials'
import { isAuthFailureMessage, remoteToBlameForAuthFailure } from '../src/renderer/src/lib/remoteUrlCredentials'
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

  it('catches a password with an unencoded slash, which git would not even send', () => {
    const r = readUrlUserinfo('https://someone:pa/ss@git.example.test/team/app.git')
    expect(r.kind).toBe('password')
    expect(r.clean).toBe('https://git.example.test/team/app.git')
    expect(r.clean).not.toContain('pa/ss')
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

  it('rewrites only the values holding a password', () => {
    expect(urlsWithoutPasswords(['https://a@x.example.test/r', 'https://b@y.example.test/r'])).toBeNull()
    expect(
      urlsWithoutPasswords([`https://u:${TOKEN}@x.example.test/r`, 'https://reader@y.example.test/r'])
    ).toEqual(['https://x.example.test/r', 'https://reader@y.example.test/r'])
  })
})

describe('an authentication failure on a remote with a password in its URL', () => {
  const creds: RemoteUrlCredentials[] = [
    { remote: 'origin', kind: 'password', urls: [{ role: 'fetch', kind: 'password', url: 'https://git.example.test/team/app.git' }] },
    { remote: 'fork', kind: 'username', urls: [{ role: 'fetch', kind: 'username', url: 'https://git.example.test/me/app.git' }] }
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
