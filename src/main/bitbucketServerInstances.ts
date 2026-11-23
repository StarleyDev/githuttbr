/**
 * The Bitbucket Data Centers the profiles name, as canonical bases. Filled by
 * settings.ts on every read and write, like the GitLab/Forgejo/GHES registries
 * in gitlabInstances.ts. Recognition only: which token a remote may receive is
 * decided per profile and per server (`bitbucketAuthFor`).
 */
let knownBitbucketServers: string[] = []

export function setKnownBitbucketServerInstances(bases: readonly string[]): void {
  knownBitbucketServers = [...new Set(bases)]
}

export function knownBitbucketServerInstances(): readonly string[] {
  return knownBitbucketServers
}

/** Whether a hostname (or `host:port`) belongs to a configured Data Center. */
export function isKnownBitbucketServerHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return knownBitbucketServers.some((base) => {
    const u = new URL(base)
    return u.hostname === h || u.host === h
  })
}
