/**
 * Reads `git describe --tags --long`: `<tag>-<n>-g<sha>`. The tag itself may
 * hold dashes (`release-2024-01`), so the count and sha are taken from the end.
 * Null when the output is not in that shape — no tag reachable, or an error.
 */
export function parseDescribeLong(out: string): { tag: string; since: number } | null {
  const m = /^(.+)-(\d+)-g[0-9a-f]+$/.exec(out.trim())
  return m ? { tag: m[1], since: Number(m[2]) } : null
}

/** The remote a repository's hosting data comes from: origin, else the first one listed. */
export function primaryRemoteUrl(configOut: string): string | null {
  const urls = new Map<string, string>()
  for (const line of configOut.split('\n')) {
    const m = /^remote\.(.+)\.url\s+(.+)$/.exec(line.trim())
    if (m && !urls.has(m[1])) urls.set(m[1], m[2])
  }
  return urls.get('origin') ?? urls.values().next().value ?? null
}
