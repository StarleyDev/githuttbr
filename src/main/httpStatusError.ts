/**
 * A host API's refusal with its HTTP status kept on it, so a caller can tell
 * "the server turned the token down" from "the server is having a bad day"
 * without reading the message (shared/tokenCheck.ts). The message is unchanged
 * from the plain Error it replaces.
 */
export class HttpStatusError extends Error {
  status: number
  /** The server said this request was throttled — GitHub uses a 403 for it. */
  rateLimited: boolean
  constructor(message: string, status: number, rateLimited = false) {
    super(message)
    this.status = status
    this.rateLimited = rateLimited
  }
}

/** The `host[:port]` of a base URL, else the base as given. */
function hostOf(base: string): string {
  try {
    return new URL(base).host || base
  } catch {
    return base
  }
}

/**
 * Tag a failure with the server it was sent to — what "could not reach …" names
 * — unless an inner call already did. Rethrown, never swallowed.
 */
export function atServer(base: string): (err: unknown) => never {
  return (err: unknown): never => {
    if (err && typeof err === 'object' && !('server' in err)) Object.assign(err, { server: hostOf(base) })
    throw err
  }
}
