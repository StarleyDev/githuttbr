import { describe, it, expect } from 'vitest'
import {
  bbsNoTokenMessage,
  boundNoCredentialMessage,
  ghesNoTokenMessage,
  githubCredentialMessage,
  noLinkedAccountMessage
} from '../src/main/hosting'
import { githubEndpoints } from '../src/shared/githubEnterprise'
import { bitbucketServerEndpoints } from '../src/shared/bitbucketServer'
import { redactForReport, reportIssueUrl } from '../src/renderer/src/lib/issueReport'

// "Report issue" opens github.com with the error in the URL — before the user
// decides anything. The messages main builds name the private server and the
// profile a repository is bound to; neither may travel.

const IPC = "Error invoking remote method 'git': Error: "
const sent = (message: string): string => {
  const url = new URL(reportIssueUrl(IPC + message))
  return `${url.searchParams.get('title')}\n${url.searchParams.get('body')}`
}

const PRIVATE = /acme|jane|gitserver|10\.1\.2\.3|203\.0\.113/i

describe('the messages main builds, reported', () => {
  const hosts = ['ghe.acme-internal.com', 'bbs.acme-internal.com:7990', 'gitserver', 'gitserver:8443', '203.0.113.9:443']

  it('drop the server of every no-token message, in any form', () => {
    for (const host of hosts) {
      const messages = [
        ghesNoTokenMessage(host),
        bbsNoTokenMessage(host),
        noLinkedAccountMessage('gitlab', host),
        noLinkedAccountMessage('forgejo', host),
        ...(['missing', 'signed-out', 'unknown', 'signed-in'] as const).map((s) => githubCredentialMessage(s, host))
      ]
      for (const m of messages) {
        const out = sent(m)
        expect(out, m).not.toMatch(PRIVATE)
        expect(out, m).toContain('<host>')
      }
    }
  })

  it('drop the profile name and the server of the bound-profile message', () => {
    for (const host of hosts) {
      const out = sent(boundNoCredentialMessage('github', 'Acme Work (jane.doe)', host))
      expect(out).not.toMatch(PRIVATE)
      expect(out).toContain('the profile "<profile>" this repository is bound to, for <host>.')
    }
  })

  it('keep a public host and a provider name standing in for one: they help the diagnosis', () => {
    expect(redactForReport(githubCredentialMessage('missing', 'github.com'))).toContain('this profile for github.com.')
    expect(redactForReport(noLinkedAccountMessage('azure', 'dev.azure.com'))).toContain('for dev.azure.com.')
    expect(redactForReport(boundNoCredentialMessage('gitlab', 'Work', 'GitLab'))).toContain('for GitLab.')
  })

  it('keep no credential from an address the endpoints refuse', () => {
    expect(() => githubEndpoints('https://jane:hunter2@ghe.acme.com')).toThrow(/^Not a GitHub Enterprise Server address: ghe\.acme\.com$/)
    expect(() => bitbucketServerEndpoints('https://jane:hun/ter2@bbs.acme.com/x?access_token=s3cret')).toThrow(
      /^Not a Bitbucket Data Center address: bbs\.acme\.com\/x$/
    )
  })
})

describe('anything shaped like a host, in any sentence', () => {
  it('is replaced unless it is public', () => {
    expect(redactForReport('request to ghe.acme-internal.com/org/repo timed out')).toBe('request to <host>/org/repo timed out')
    expect(redactForReport('TLS handshake with bbs.acme.corp:7990 failed')).toBe('TLS handshake with <host> failed')
    expect(redactForReport('upstream is ghe.ACME.com')).toBe('upstream is <host>')
    expect(redactForReport('rate limited by api.github.com')).toBe('rate limited by api.github.com')
    expect(redactForReport('ECONNREFUSED 203.0.113.7:443')).toBe('ECONNREFUSED <ip>:443')
  })

  it('leaves file names and code alone', () => {
    for (const text of [
      'could not parse package.json',
      'error in src/main/git.ts at line 4',
      'vite.config.ts failed to load',
      "Unable to create '.git/index.lock': File exists",
      'litellm.InternalServerError: AsyncCompletions.create() failed',
      'version 4.38.0 is out',
      'e.g. a token'
    ]) {
      expect(redactForReport(text), text).toBe(text)
    }
  })
})

describe('token shapes', () => {
  it('covers the hosts and AI providers the app talks to', () => {
    for (const secret of [
      'gsk_abcdefghijklmnopqrstuvwxyz0123',
      'ATATT3xFfGF0abcdefghijklmnopqrstuvwxyz',
      'BBDC-NjM0NTY3ODkwMTIzOkxqY2Y',
      'gldt-abcdefghijklmnopqrst',
      'glptt-abcdefghijklmnopqrstuv',
      'ghp_abcdefghijklmnopqrstuvwxyz0123',
      'sk-proj-abcdefghijklmnopqrstu'
    ]) {
      expect(sent(`request failed with ${secret} attached`), secret).not.toContain(secret.slice(5))
    }
  })
})
