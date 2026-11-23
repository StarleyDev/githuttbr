/**
 * Whether a remote's path could name one place to the app and another to the
 * server — or a reverse proxy in front of it — that git actually talks to.
 *
 * Every server matcher compares a remote's path against a base's context path
 * (`https://host/bitbucket` owns `/bitbucket/…`). A proxy that decodes or
 * normalises the path before routing would send `/bitbucket%2F..%2Fother/r.git`
 * to `/other/` — another server on that host — while a matcher that decoded it
 * first would still offer the Data Center's token. So a path is ambiguous, and
 * resolves to no server at all, when it holds:
 *
 * - a backslash, which some servers read as a separator;
 * - a `.` or `..` segment (`new URL` resolves them away, so the raw text is read);
 * - a percent-encoded `/`, `\` or unreserved character (`%2F`, `%5C`, `%2E`,
 *   `%62` …) — something a decoder changes and a matcher would not see;
 * - a `%` that is not an escape, which decoders disagree about;
 * - a `;`, raw or as `%3B`: Tomcat (the Data Center's server) drops a
 *   segment's `;params` before routing, so `/bitbucket;x/…` is the Data Center
 *   to it and the GitLab at the root to a prefix matcher;
 * - `%00`, which a server may read as the end of the path.
 *
 * Ordinary escapes (`%20`) are fine: they decode to nothing a router splits on.
 */
export function ambiguousRemotePath(url: string): boolean {
  const path = rawPathOf(url.trim())
  if (path.includes('\\') || path.includes(';')) return true
  if (path.split('/').some((seg) => seg === '.' || seg === '..')) return true
  if (/%(?![0-9a-f]{2})/i.test(path)) return true
  for (const m of path.matchAll(/%([0-9a-f]{2})/gi)) {
    if (/[A-Za-z0-9\-._~/\\;\0]/.test(String.fromCharCode(parseInt(m[1], 16)))) return true
  }
  return false
}

/** The path as written — before `new URL` resolves dot segments or turns `\` into `/`. */
function rawPathOf(url: string): string {
  const scheme = /^[a-z][a-z0-9+.-]*:\/\/[^/\\?#]*/i.exec(url)
  if (scheme) return url.slice(scheme[0].length).replace(/[?#].*$/s, '')
  // scp-style `[user@]host:path`.
  const scp = /^(?:[\w.-]+@)?[\w.-]+:(.*)$/s.exec(url)
  return scp ? scp[1] : ''
}
