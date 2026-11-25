import { describe, it, expect, vi, afterEach } from 'vitest'
import { tokenCheckFailure, tokenCheckFaultOf, tokenCheckKind } from '../src/shared/tokenCheck'
import { atServer, HttpStatusError } from '../src/main/httpStatusError'
import { describeForgejoAccount } from '../src/main/forgejo'
import { describeBbsAccount } from '../src/main/bitbucketServer'
import { adoJson } from '../src/main/hosting'

// Settings → Integrations tells a token the server refused from a server it
// could not ask. The verdict is decided from the status (or the network
// failure) in main — these pin down the table and every provider's throw site.

/** What undici's fetch throws when the request never got an answer. */
function fetchFailed(code: string, message: string): TypeError {
  return new TypeError('fetch failed', { cause: Object.assign(new Error(message), { code }) })
}

describe('tokenCheckKind', () => {
  it('a server that answered 401 or 403 refused the token', () => {
    expect(tokenCheckKind({ status: 401 })).toBe('refused')
    expect(tokenCheckKind({ status: 403 })).toBe('refused')
  })

  it('a rate limit says nothing about the token, whatever its status', () => {
    expect(tokenCheckKind({ status: 429 })).toBe('unreachable')
    // GitHub throttles with a 403.
    expect(tokenCheckKind({ status: 403, rateLimited: true })).toBe('unreachable')
  })

  it('a server error, a proxy or a timeout is "could not check"', () => {
    for (const status of [500, 502, 503, 504, 407, 408]) expect(tokenCheckKind({ status })).toBe('unreachable')
    expect(tokenCheckKind({ network: true })).toBe('unreachable')
  })

  it('anything else stays a plain error', () => {
    for (const status of [400, 404, 410, 422]) expect(tokenCheckKind({ status })).toBe('error')
    expect(tokenCheckKind({})).toBe('error')
    expect(tokenCheckKind({ network: false })).toBe('error')
  })
})

describe('tokenCheckFaultOf', () => {
  it('reads the status a thrower kept on the error', () => {
    expect(tokenCheckFaultOf(new HttpStatusError('GitLab API error (401)', 401))).toEqual({ status: 401, rateLimited: false })
    expect(tokenCheckFaultOf(new HttpStatusError('limit', 403, true))).toEqual({ status: 403, rateLimited: true })
    // Not a status: a string, or out of range.
    expect(tokenCheckFaultOf(Object.assign(new Error('x'), { status: '401' }))).toEqual({ network: false })
    expect(tokenCheckFaultOf(Object.assign(new Error('x'), { status: 0 }))).toEqual({ network: false })
  })

  it('recognises DNS, connection, TLS and timeout failures on the cause', () => {
    for (const code of [
      'ENOTFOUND',
      'EAI_AGAIN',
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENETUNREACH',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_SOCKET',
      'CERT_HAS_EXPIRED',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'SELF_SIGNED_CERT_IN_CHAIN',
      'ERR_TLS_CERT_ALTNAME_INVALID'
    ]) {
      expect(tokenCheckFaultOf(fetchFailed(code, code)), code).toEqual({ network: true })
    }
    expect(tokenCheckFaultOf(new DOMException('The operation was aborted.', 'TimeoutError'))).toEqual({ network: true })
    expect(tokenCheckFaultOf(new DOMException('aborted', 'AbortError'))).toEqual({ network: true })
    // fetch's own wrapper, whatever the cause says.
    expect(tokenCheckFaultOf(new TypeError('fetch failed'))).toEqual({ network: true })
  })

  it('a setting that is missing, or a reply that is not JSON, is not a network failure', () => {
    expect(tokenCheckFaultOf(new Error('No Forgejo address is saved in this profile'))).toEqual({ network: false })
    expect(tokenCheckFaultOf(new SyntaxError('Unexpected token <'))).toEqual({ network: false })
    expect(tokenCheckFaultOf('nope')).toEqual({})
  })
})

describe('tokenCheckFailure', () => {
  it('names the server, and shows the reason fetch hides on its cause', () => {
    let thrown: unknown
    try {
      atServer('https://git.example.org/sub')(fetchFailed('ENOTFOUND', 'getaddrinfo ENOTFOUND git.example.org'))
    } catch (err) {
      thrown = err
    }
    expect(tokenCheckFailure(thrown)).toEqual({
      kind: 'unreachable',
      message: 'getaddrinfo ENOTFOUND git.example.org',
      server: 'git.example.org'
    })
  })

  it('a refusal keeps the server’s words as the detail', () => {
    expect(tokenCheckFailure(new HttpStatusError('Forgejo: user does not exist', 401))).toEqual({
      kind: 'refused',
      message: 'Forgejo: user does not exist'
    })
  })

  it('the innermost server tag wins', () => {
    let thrown: unknown
    try {
      try {
        atServer('https://inner.example:8443')(new HttpStatusError('x', 503))
      } catch (err) {
        atServer('https://outer.example')(err)
      }
    } catch (err) {
      thrown = err
    }
    expect(tokenCheckFailure(thrown).server).toBe('inner.example:8443')
  })
})

// Each provider's own request helper: the status has to survive to the check.
describe('every provider keeps the status on its failure', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  const reply = (status: number, body: unknown = {}, headers: Record<string, string> = {}): void => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers }))
    )
  }
  const kindOf = async (p: Promise<unknown>): Promise<string> => {
    try {
      await p
      return 'ok'
    } catch (err) {
      return tokenCheckFailure(err).kind
    }
  }

  it('Forgejo', async () => {
    reply(401, { message: 'user does not exist' })
    expect(await kindOf(describeForgejoAccount('https://git.example.org', 'bad'))).toBe('refused')
    // A token without the read:user scope.
    reply(403, { message: 'token does not have at least one of required scope(s): [read:user]' })
    expect(await kindOf(describeForgejoAccount('https://git.example.org', 'narrow'))).toBe('refused')
    reply(502)
    expect(await kindOf(describeForgejoAccount('https://git.example.org', 'tok'))).toBe('unreachable')
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(fetchFailed('ECONNREFUSED', 'connect ECONNREFUSED'))))
    expect(await kindOf(describeForgejoAccount('https://git.example.org', 'tok'))).toBe('unreachable')
  })

  it('Bitbucket Data Center — including a token the server answers anonymously', async () => {
    reply(401)
    expect(await kindOf(describeBbsAccount('https://bbs.example.com', 'bad'))).toBe('refused')
    // No x-ausername: the server served the request as nobody.
    reply(200, {})
    expect(await kindOf(describeBbsAccount('https://bbs.example.com', 'bad'))).toBe('refused')
    reply(503)
    expect(await kindOf(describeBbsAccount('https://bbs.example.com', 'tok'))).toBe('unreachable')
    reply(429)
    expect(await kindOf(describeBbsAccount('https://bbs.example.com', 'tok'))).toBe('unreachable')
  })

  it('Azure DevOps — its sign-in page for a bad PAT is a refusal', async () => {
    reply(203, '<html>sign in</html>', { 'content-type': 'text/html' })
    expect(await kindOf(adoJson('https://dev.azure.com/org/_apis/connectionData', 'bad'))).toBe('refused')
    reply(401, '')
    expect(await kindOf(adoJson('https://dev.azure.com/org/_apis/connectionData', 'bad'))).toBe('refused')
    reply(500, { message: 'TF400898: An Internal Error Occurred' })
    expect(await kindOf(adoJson('https://dev.azure.com/org/_apis/connectionData', 'tok'))).toBe('unreachable')
    reply(404, '')
    expect(await kindOf(adoJson('https://dev.azure.com/missing/_apis/connectionData', 'tok'))).toBe('error')
  })
})
