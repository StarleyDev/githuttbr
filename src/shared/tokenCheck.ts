import type { ConnectedAccount } from './types'

/**
 * Why Settings → Integrations could not show the account behind a token:
 * - `refused`: the server answered and turned the token down (401/403, or the
 *   provider's own "bad credentials") — wrong, expired, or missing a scope;
 * - `unreachable`: no verdict on the token at all — offline, DNS, TLS, a proxy,
 *   a timeout, a 5xx or a rate limit; the token may well be fine;
 * - `error`: anything else (a 404, a setting that is missing) — shown as before.
 * Decided in main, where the HTTP status is known, so the renderer never has to
 * guess from a message.
 */
export type TokenCheckFailureKind = 'refused' | 'unreachable' | 'error'

export interface TokenCheckFailure {
  kind: TokenCheckFailureKind
  /** The underlying English message — the detail under the verdict, and the whole of an `error`. */
  message: string
  /** `host[:port]` the check was sent to, when known — what "could not reach …" names. */
  server?: string
}

/** What `hosting:whoAmI` answers: the account (null = nothing to check), or why there is none. */
export type TokenCheckResult = { ok: true; account: ConnectedAccount | null } | { ok: false; failure: TokenCheckFailure }

/** The facts a failure carries that decide its kind. */
export interface TokenCheckFault {
  /** The HTTP status, when the server answered. */
  status?: number
  /** The server said the request was throttled — whatever the status it used for it. */
  rateLimited?: boolean
  /** The request never got an HTTP answer: DNS, connection, TLS, timeout, abort. */
  network?: boolean
}

/** The verdict for a failure's facts. Pure: the table the tests pin down. */
export function tokenCheckKind(fault: TokenCheckFault): TokenCheckFailureKind {
  const { status } = fault
  if (status !== undefined) {
    // GitHub throttles with a 403 too: a limit says nothing about the token.
    if (fault.rateLimited || status === 429) return 'unreachable'
    if (status === 401 || status === 403) return 'refused'
    // 407: a proxy wants its own credentials; 408: the server gave up waiting.
    if (status >= 500 || status === 407 || status === 408) return 'unreachable'
    return 'error'
  }
  return fault.network ? 'unreachable' : 'error'
}

// Node's socket, DNS and TLS codes, and undici's — fetch reports them on the error's `cause`.
const NETWORK_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'EAI_FAIL',
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'EHOSTDOWN',
  'ENETUNREACH',
  'ENETDOWN',
  'EPIPE',
  'EPROTO',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT'
])
const NETWORK_CODE_PREFIXES = ['UND_ERR_', 'ERR_TLS_', 'ERR_SSL_', 'CERT_', 'UNABLE_TO_']
const NETWORK_NAMES = new Set(['AbortError', 'TimeoutError', 'ConnectTimeoutError', 'HeadersTimeoutError', 'SocketError'])

const field = (o: object, key: string): unknown => (o as Record<string, unknown>)[key]

/** Whether an error (or one of its causes) is a request that never got an HTTP answer. */
function isNetworkFailure(err: unknown): boolean {
  // `redirect: 'error'` refusing a redirect also surfaces as "fetch failed", but
  // the server did answer — with a redirect, which is a misconfigured address,
  // not an unreachable one.
  if (hasCauseMessage(err, 'unexpected redirect')) return false
  let e: unknown = err
  for (let depth = 0; depth < 5 && e && typeof e === 'object'; depth++) {
    const code = field(e, 'code')
    if (typeof code === 'string' && (NETWORK_CODES.has(code) || NETWORK_CODE_PREFIXES.some((p) => code.startsWith(p)))) {
      return true
    }
    const name = field(e, 'name')
    if (typeof name === 'string' && NETWORK_NAMES.has(name)) return true
    // undici's fetch: every transport failure is this TypeError, the reason on `cause`.
    if (name === 'TypeError' && field(e, 'message') === 'fetch failed') return true
    e = field(e, 'cause')
  }
  return false
}

/** Whether an error, or one of its causes, carries exactly this message. */
function hasCauseMessage(err: unknown, message: string): boolean {
  let e: unknown = err
  for (let depth = 0; depth < 5 && e && typeof e === 'object'; depth++) {
    if (field(e, 'message') === message) return true
    e = field(e, 'cause')
  }
  return false
}

/** The facts of a thrown failure: a numeric `status` (and `rateLimited`) its thrower set, or a network cause. */
export function tokenCheckFaultOf(err: unknown): TokenCheckFault {
  if (!err || typeof err !== 'object') return {}
  const status = field(err, 'status')
  if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) {
    return { status, rateLimited: field(err, 'rateLimited') === true }
  }
  return { network: isNetworkFailure(err) }
}

/**
 * The words worth showing for a failure: its own message, except fetch's bare
 * "fetch failed", which hides the reason (`getaddrinfo ENOTFOUND …`) on its cause.
 */
function failureMessage(err: unknown): string {
  let message = err instanceof Error ? err.message : String(err)
  let e: unknown = err
  for (let depth = 0; depth < 5 && message === 'fetch failed'; depth++) {
    e = e && typeof e === 'object' ? field(e, 'cause') : undefined
    const inner = e && typeof e === 'object' ? field(e, 'message') : undefined
    if (typeof inner !== 'string') break
    if (inner) message = inner
  }
  return message
}

/** A thrown failure as the renderer receives it. */
export function tokenCheckFailure(err: unknown): TokenCheckFailure {
  const message = failureMessage(err)
  const server = err && typeof err === 'object' ? field(err, 'server') : undefined
  return {
    kind: tokenCheckKind(tokenCheckFaultOf(err)),
    message,
    ...(typeof server === 'string' && server ? { server } : {})
  }
}
